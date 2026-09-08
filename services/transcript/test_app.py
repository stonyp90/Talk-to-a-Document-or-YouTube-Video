import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from requests.exceptions import Timeout
from youtube_transcript_api import TranscriptsDisabled, RequestBlocked
from app import retrieve


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

    def test_empty_captions(self):
        api = Mock()
        api.list.return_value.find_transcript.return_value.fetch.return_value = []
        self.assertEqual(retrieve("dQw4w9WgXcQ", "live", api)[0], 404)


if __name__ == "__main__":
    unittest.main()
