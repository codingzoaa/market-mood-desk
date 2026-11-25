import unittest
import uuid
import tkinter as tk
import secure_store
from app import Application
class WindowsSmoke(unittest.TestCase):
    def test_dpapi_roundtrip(self):
        raw = b'synthetic-test-only'
        encrypted = secure_store.crypt(raw)
        self.assertNotIn(raw, encrypted)
        self.assertEqual(secure_store.crypt(encrypted, True), raw)
    def test_ui_opens_without_query(self):
        root = tk.Tk()
        try:
            app = Application(root)
            root.update()
            self.assertFalse(app.running)
            self.assertIsNone(app.client)
            self.assertIn('LS', root.title())
        finally:
            root.destroy()
if __name__ == '__main__':
    unittest.main()
