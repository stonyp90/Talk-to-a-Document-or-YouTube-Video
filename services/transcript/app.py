"""Internal captions adapter. No credentials, scraping proxies, or mock fallback."""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from requests import Session
from requests.exceptions import Timeout
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, RequestBlocked, IpBlocked


class BoundedSession(Session):
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
        return failure(403, "CLOUD_BLOCKED", "YouTube blocked requests from this network or cloud provider.")
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
            status, body = 200, {"status": "ok", "mode": os.environ.get("TRANSCRIPT_MODE", "live")}
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
