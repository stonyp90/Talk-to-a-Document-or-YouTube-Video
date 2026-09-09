"""Internal captions adapter.

YouTube serves captions through an unofficial endpoint that it blocks from cloud
provider address ranges, so a deployment on AWS is refused where a laptop is not.
An outbound proxy is therefore configurable: set TRANSCRIPT_PROXY_URL (or the
scheme-specific pair) to route caption requests through an address YouTube will
answer. Without it the service behaves exactly as before and reports CLOUD_BLOCKED.
The proxy address is a credential and is never logged or returned.
"""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from requests import Session
from requests.exceptions import Timeout
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, RequestBlocked, IpBlocked


def proxy_settings():
    """Reads outbound proxy configuration. Returns an empty mapping when unset."""
    shared = os.environ.get("TRANSCRIPT_PROXY_URL", "").strip()
    http_url = os.environ.get("TRANSCRIPT_PROXY_HTTP_URL", "").strip() or shared
    https_url = os.environ.get("TRANSCRIPT_PROXY_HTTPS_URL", "").strip() or shared
    return {k: v for k, v in (("http", http_url), ("https", https_url)) if v}


class BoundedSession(Session):
    def __init__(self):
        super().__init__()
        self.proxies.update(proxy_settings())

    def request(self, method, url, **kwargs):
        kwargs["timeout"] = float(os.environ.get("UPSTREAM_TIMEOUT_SECONDS", "10"))
        return super().request(method, url, **kwargs)


def failure(status, code, message):
    return status, {"error": {"code": code, "message": message}}


def retrieve(video_id, mode="live", api=None):
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        return failure(400, "INVALID_VIDEO_ID", "An 11-character YouTube video ID is required.")
    if mode == "mock":
        if video_id == "missing0000":
            return failure(404, "NO_CAPTIONS", "No captions are available for this video.")
        return 200, {"title": f"Demo video {video_id}", "text": "This is a deterministic local transcript. It is available for local BDD and simulator testing."}
    if mode != "live":
        return failure(500, "CONFIGURATION_ERROR", "Unknown transcript mode.")
    session = None
    try:
        if api is None:
            session = BoundedSession()
            api = YouTubeTranscriptApi(http_client=session)
        available = api.list(video_id)
        try:
            selected = available.find_transcript(["en"])
        except NoTranscriptFound:
            selected = next(iter(available), None)
        if selected is None:
            return failure(404, "NO_CAPTIONS", "No captions are available for this video.")
        text = "\n".join(snippet.text.strip() for snippet in selected.fetch() if snippet.text.strip())
        if not text:
            return failure(404, "NO_CAPTIONS", "No captions are available for this video.")
        return 200, {"title": f"YouTube video {video_id}", "text": text}
    except (RequestBlocked, IpBlocked):
        detail = (
            "YouTube blocked requests from this network or cloud provider."
            if not proxy_settings()
            else "YouTube blocked requests even through the configured proxy."
        )
        return failure(403, "CLOUD_BLOCKED", detail)
    except (TranscriptsDisabled, NoTranscriptFound):
        return failure(404, "NO_CAPTIONS", "No captions are available for this video.")
    except Timeout:
        return failure(504, "TRANSCRIPT_TIMEOUT", "YouTube transcript retrieval timed out.")
    except Exception:
        return failure(502, "UPSTREAM_ERROR", "YouTube transcript retrieval failed.")
    finally:
        if session is not None:
            session.close()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            status, body = 200, {
                "status": "ok",
                "mode": os.environ.get("TRANSCRIPT_MODE", "live"),
                # Whether a proxy is configured, never which one.
                "proxied": bool(proxy_settings()),
            }
        elif path.startswith("/transcript/"):
            status, body = retrieve(path.removeprefix("/transcript/"), os.environ.get("TRANSCRIPT_MODE", "live"))
        else:
            status, body = failure(404, "NOT_FOUND", "Route not found.")
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "3010"))), Handler).serve_forever()
