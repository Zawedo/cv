import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from mail_cleaner import oauth_ms


class OAuthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(oauth_ms, "TOKEN_DIR", Path(self.tmp.name))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_device_flow_then_refresh(self):
        replies = iter([
            {"device_code": "D", "user_code": "ABC", "verification_uri": "https://microsoft.com/devicelogin",
             "interval": 0, "expires_in": 60},
            {"error": "authorization_pending"},
            {"access_token": "A1", "refresh_token": "R1"},
            {"access_token": "A2", "refresh_token": "R2"},
        ])
        with mock.patch.object(oauth_ms, "_post", side_effect=lambda u, d: next(replies)), \
             mock.patch("time.sleep"), mock.patch("builtins.print"):
            self.assertEqual(oauth_ms.get_access_token("me@outlook.com", "cid"), "A1")
            f = Path(self.tmp.name) / "outlook-me@outlook.com.json"
            self.assertEqual(oct(f.stat().st_mode & 0o777), "0o600")
            # 2e lancement : pas de navigateur, le jeton enregistré suffit
            self.assertEqual(oauth_ms.get_access_token("me@outlook.com", "cid", interactive=False), "A2")
        self.assertIn("R2", f.read_text())
        self.assertTrue(oauth_ms.forget("me@outlook.com"))

    def test_non_interactive_without_token(self):
        with self.assertRaises(oauth_ms.AuthError):
            oauth_ms.get_access_token("x@outlook.com", "cid", interactive=False)


if __name__ == "__main__":
    unittest.main()
