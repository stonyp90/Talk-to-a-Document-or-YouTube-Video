import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from requests.exceptions import Timeout
from youtube_transcript_api import TranscriptsDisabled, RequestBlocked
from app import BoundedSession, proxy_settings, retrieve


class RetrievalTests(unittest.TestCase):
    def test_live_returns_real_ordered_snippets(self):
        api = Mock()
        api.list.return_value.find_transcript.return_value.fetch.return_value = [SimpleNamespace(text="First"), SimpleNamespace(text="Second")]
        status, body = retrieve("dQw4w9WgXcQ", "live", api)
        self.assertEqual(status, 200)
        self.assertEqual(body["text"], "First\nSecond")
        api.list.assert_called_once_with("dQw4w9WgXcQ")

    def test_failures_are_distinct(self):
        for error, status, code in [(TranscriptsDisabled("dQw4w9WgXcQ"), 404, "NO_CAPTIONS"), (RequestBlocked("dQw4w9WgXcQ"), 403, "CLOUD_BLOCKED"), (Timeout(), 504, "TRANSCRIPT_TIMEOUT"), (RuntimeError("private upstream detail"), 502, "UPSTREAM_ERROR")]:
            with self.subTest(code=code):
                api = Mock()
                api.list.side_effect = error
                result, body = retrieve("dQw4w9WgXcQ", "live", api)
                self.assertEqual(result, status)
                self.assertEqual(body["error"]["code"], code)
                self.assertNotIn("private", str(body))

    def test_mock_never_calls_youtube(self):
        api = Mock()
        self.assertEqual(retrieve("dQw4w9WgXcQ", "mock", api), retrieve("dQw4w9WgXcQ", "mock", api))
        api.list.assert_not_called()

    def test_invalid_id_never_calls_youtube(self):
        api = Mock()
        self.assertEqual(retrieve("../../etc", "live", api)[0], 400)
        api.list.assert_not_called()

    def test_no_proxy_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(proxy_settings(), {})

    def test_shared_proxy_covers_both_schemes(self):
        with patch.dict(os.environ, {"TRANSCRIPT_PROXY_URL": "http://user:pass@proxy.test:8080"}, clear=True):
            self.assertEqual(
                proxy_settings(),
                {"http": "http://user:pass@proxy.test:8080", "https": "http://user:pass@proxy.test:8080"},
            )

    def test_scheme_specific_proxy_overrides_the_shared_one(self):
        with patch.dict(os.environ, {"TRANSCRIPT_PROXY_URL": "http://shared.test:1", "TRANSCRIPT_PROXY_HTTPS_URL": "http://secure.test:2"}, clear=True):
            self.assertEqual(proxy_settings()["https"], "http://secure.test:2")
            self.assertEqual(proxy_settings()["http"], "http://shared.test:1")

    def test_session_applies_the_configured_proxy(self):
        with patch.dict(os.environ, {"TRANSCRIPT_PROXY_URL": "http://proxy.test:8080"}, clear=True):
            self.assertEqual(BoundedSession().proxies["https"], "http://proxy.test:8080")

    def test_blocked_message_states_that_the_proxy_was_also_refused(self):
        api = Mock()
        api.list.side_effect = RequestBlocked("dQw4w9WgXcQ")
        with patch.dict(os.environ, {"TRANSCRIPT_PROXY_URL": "http://proxy.test:8080"}, clear=True):
            _, body = retrieve("dQw4w9WgXcQ", "live", api)
        self.assertIn("proxy", body["error"]["message"])
        self.assertNotIn("proxy.test", str(body))

    def test_empty_captions(self):
        api = Mock()
        api.list.return_value.find_transcript.return_value.fetch.return_value = []
        self.assertEqual(retrieve("dQw4w9WgXcQ", "live", api)[0], 404)


if __name__ == "__main__":
    unittest.main()
