from contextlib import redirect_stderr
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO, StringIO
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

import openpyxl
from PIL import Image
import requests

import build_deck as deck


class DeckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = BytesIO()
        Image.new("RGBA", (2400, 1200), (255, 50, 0, 100)).save(raw, "PNG")
        cls.png = raw.getvalue()
        cls.hits = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                cls.hits.append(self.path)
                if self.path == "/redirect":
                    self.send_response(302)
                    self.send_header("Location", "/image")
                    self.end_headers()
                    return
                if self.path == "/missing":
                    self.send_error(404)
                    return
                body, mime = cls.png, "image/png"
                if self.path == "/html":
                    body, mime = b"<html>preview</html>", "text/html"
                elif self.path == "/fake":
                    body = b"<html>not an image</html>"
                elif self.path == "/corrupt":
                    body = b"broken image content"
                elif self.path == "/binary":
                    mime = "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "source.json"
        self.output = self.root / "result"

    def write_rows(self, rows):
        self.source.write_text(json.dumps({"cardsData": rows}, ensure_ascii=False), encoding="utf-8")

    def run_build(self, *extra, source=None):
        with self.assertLogs("deck", level="INFO"):
            return deck.main([str(source or self.source), "--output-dir", str(self.output), *extra])

    def cards(self):
        return json.loads((self.output / "cardsData.json").read_text(encoding="utf-8"))

    def test_slug_examples_and_windows_names(self):
        for source, expected in [
            ("Nicholas Galitzine", "nicholas-galitzine"),
            ("John Logan (Antonio Cipriano)", "john-logan-antonio-cipriano"),
            ("Dylan O'Brien", "dylan-obrien"),
            ("L’Ange déchu", "lange-dechu"),
            ("Cœur", "coeur"), ("CON", "carte-con"), ("🤓", "carte"),
        ]:
            with self.subTest(source=source):
                self.assertEqual(deck.slugify(source), expected)

    def test_drive_urls_and_resourcekey(self):
        for url in ["https://drive.google.com/file/d/abc_123-XYZ/view",
                    "https://drive.google.com/open?id=abc_123-XYZ",
                    "https://drive.google.com/uc?export=view&id=abc_123-XYZ",
                    "https://drive.usercontent.google.com/download?id=abc_123-XYZ"]:
            self.assertEqual(deck.drive_info(url), ("abc_123-XYZ", ""))
        self.assertEqual(deck.drive_info("https://drive.google.com/file/d/ID/view?resourcekey=key"), ("ID", "key"))
        self.assertIsNone(deck.drive_info("https://drive.google.com.evil.example/uc?id=abc"))
        with self.assertRaises(deck.DeckError):
            deck.drive_info("https://drive.google.com/drive/folders/abc")

    def test_drive_confirmation_is_scoped_to_file_and_host(self):
        html = b'<form action="https://drive.usercontent.google.com/download"><input type="hidden" name="id" value="abc"><input type="hidden" name="confirm" value="token"></form>'
        url = deck.confirmation_url(html, "https://drive.google.com/uc", "abc")
        self.assertIn("id=abc", url)
        self.assertIn("confirm=token", url)
        self.assertIsNone(deck.confirmation_url(html, "https://drive.google.com/uc", "other"))
        self.assertIsNone(deck.confirmation_url(html.replace(b"drive.usercontent.google.com", b"evil.example"), "https://drive.google.com/uc", "abc"))

    def test_http_redirect_content_types_and_invalid_images(self):
        self.write_rows([
            {"name": "OK", "image": self.url + "/redirect"},
            {"name": "Binary", "image": self.url + "/binary"},
            {"name": "Page", "image": self.url + "/html"},
            {"name": "Fake", "image": self.url + "/fake"},
            {"name": "Corrupt", "image": self.url + "/corrupt"},
            {"name": "Missing", "image": self.url + "/missing"},
            {"name": "No image"},
        ])
        self.assertEqual(self.run_build(), 2)
        cards = self.cards()
        self.assertEqual([card["name"] for card in cards], ["OK", "Binary"])
        self.assertEqual(cards[0]["credit"], "")
        with Image.open(self.output / "images/ok.webp") as image:
            self.assertEqual(image.size, (1600, 800))
            self.assertEqual(image.mode, "RGBA")
        snippet = json.loads((self.output / "streamelements-data-snippet.json").read_text())
        self.assertEqual(snippet, {"cardsData": cards})
        report = (self.output / "build-report.md").read_text(encoding="utf-8")
        self.assertIn("Cartes sélectionnées ignorées : 5", report)
        self.assertIn(self.url + "/html", report)
        self.assertEqual(len(list((self.output / "images").glob("*.webp"))), 2)

    def test_reuse_force_failure_and_json_backups(self):
        self.write_rows([{"name": "Joe", "image": self.url + "/image"}])
        self.assertEqual(self.run_build(), 0)
        destination = self.output / "images/joe.webp"
        Image.new("RGB", (9, 7), "blue").save(destination, "WEBP")
        corrected = destination.read_bytes()
        with patch.object(deck, "download_image", side_effect=AssertionError("must reuse")):
            self.assertEqual(self.run_build(), 0)
        self.assertEqual(destination.read_bytes(), corrected)
        with patch.object(deck, "download_image", side_effect=deck.DeckError("échec forcé")):
            self.assertEqual(self.run_build("--force"), 2)
        self.assertEqual(destination.read_bytes(), corrected)
        self.assertEqual(self.cards(), [])
        backups = list((self.output / ".build-backups").glob("*-cardsData.json"))
        self.assertTrue(backups)
        self.assertEqual(json.loads(backups[0].read_text())[0]["name"], "Joe")
        self.assertEqual(self.run_build("--force"), 0)
        with Image.open(destination) as image:
            self.assertEqual(image.size, (1600, 800))

    def test_collision_mapping_survives_reorder_and_source_change(self):
        a = {"name": "Éric", "image": self.url + "/image"}
        b = {"name": "Eric", "image": self.url + "/binary"}
        c = {"name": "Eric 2", "image": self.url + "/image"}
        self.write_rows([a, b, c])
        self.assertEqual(self.run_build(), 0)
        original = {card["name"]: card["image"] for card in self.cards()}
        self.assertEqual(len(set(original.values())), 3)
        self.write_rows([c, b, a])
        self.assertEqual(self.run_build(), 0)
        self.assertEqual({card["name"]: card["image"] for card in self.cards()}, original)
        self.write_rows([{**a, "image": self.url + "/redirect"}])
        self.assertEqual(self.run_build(), 0)
        self.assertNotEqual(self.cards()[0]["image"], original["Éric"])
        self.assertTrue((self.output / "images/eric.webp").exists())

    def test_excel_exact_status_optional_blanks_hyperlink_and_errors(self):
        source = self.root / "source.xlsx"
        workbook = openpyxl.Workbook()
        ws = workbook.active
        ws.title = deck.SHEET
        ws.append(list(deck.HEADERS))
        ws.append(["Prêt", "Joe", None, None, "Voir l'image"])
        ws["E2"].hyperlink = self.url + "/image"
        ws.append(["Prêt ", "Ignored space", "", "", self.url + "/image"])
        ws.append(["prêt", "Ignored case", "", "", self.url + "/image"])
        ws.append(["Prêt", None, "", "", self.url + "/image"])
        workbook.save(source)
        workbook.close()
        self.assertEqual(self.run_build(source=source), 2)
        self.assertEqual(len(self.cards()), 1)
        self.assertEqual(self.cards()[0]["origin"], "")
        report = (self.output / "build-report.md").read_text(encoding="utf-8")
        self.assertIn("Lignes au statut exactement Prêt : 2", report)
        self.assertIn("Lignes hors statut Prêt : 2", report)
        self.assertIn("| 5 |", report)

    def test_exif_orientation_and_no_upscale(self):
        raw = BytesIO()
        original = Image.new("RGB", (100, 50), "red")
        exif = original.getexif()
        exif[274] = 6
        original.save(raw, "JPEG", exif=exif)
        destination = self.root / "rotated.webp"
        deck.normalize_image(raw.getvalue(), destination, 1600, 85)
        with Image.open(destination) as image:
            self.assertEqual(image.size, (50, 100))

    def test_local_image_missing_file_and_no_source_overwrite(self):
        (self.root / "local.png").write_bytes(self.png)
        self.write_rows([{"name": "Local", "image": "local.png"}, {"name": "Missing", "image": "unknown.jpg"}])
        self.assertEqual(self.run_build(), 2)
        self.assertEqual([card["name"] for card in self.cards()], ["Local"])
        path = self.output / "cardsData.json"
        before = path.read_bytes()
        self.assertEqual(self.run_build(source=path), 1)
        self.assertEqual(path.read_bytes(), before)

    def test_corrupt_existing_webp_and_manifest_are_preserved(self):
        self.output.mkdir()
        (self.output / "images").mkdir()
        target = self.output / "images/joe.webp"
        target.write_bytes(b"manual invalid content")
        self.write_rows([{"name": "Joe", "image": self.url + "/image"}])
        self.assertEqual(self.run_build(), 2)
        self.assertEqual(target.read_bytes(), b"manual invalid content")
        self.assertEqual(self.run_build("--force"), 0)
        manifest = self.output / "build-manifest.json"
        manifest.write_text("{}")
        before = (self.output / "cardsData.json").read_bytes()
        self.assertEqual(self.run_build(), 1)
        self.assertEqual((self.output / "cardsData.json").read_bytes(), before)

    def test_download_size_limit(self):
        with requests.Session() as session, patch.object(deck, "MAX_BYTES", 10):
            with self.assertRaisesRegex(deck.DeckError, "volumineuse"):
                deck.download_image(session, self.url + "/image", 2)

    def test_json_malformed_rows_and_empty_deck(self):
        self.source.write_text(json.dumps([{}, None, {"name": ["bad"], "image": "bad"}]))
        self.assertEqual(self.run_build(), 2)
        self.assertEqual(self.cards(), [])

        self.source.write_text("[]")
        self.assertEqual(self.run_build(), 0)
        self.assertEqual(self.cards(), [])

    def test_manual_image_map_is_offline_preserves_sources_and_identity(self):
        original = self.root / "Photo téléchargée.png"
        original.write_bytes(self.png)
        mapping = self.root / "images-map.json"
        mapping.write_text(json.dumps({"Joe": original.name}), encoding="utf-8")
        self.write_rows([{"name": "Joe", "image": "https://drive.google.com/file/d/abc/view"}])
        before = original.read_bytes()
        with patch.object(deck, "download_image", side_effect=AssertionError("must stay offline")):
            self.assertEqual(self.run_build("--image-map", str(mapping)), 0)
        self.assertEqual(original.read_bytes(), before)
        self.assertTrue(self.cards()[0]["image"].endswith("/joe.webp"))
        manifest = (self.output / "build-manifest.json").read_bytes()
        self.assertEqual(self.run_build("--image-map", str(mapping)), 0)
        self.assertEqual((self.output / "build-manifest.json").read_bytes(), manifest)
        report = (self.output / "build-report.md").read_text(encoding="utf-8")
        self.assertIn(original.name, report)
        mapping.write_text(json.dumps({"Unknown": original.name}))
        self.assertEqual(self.run_build("--image-map", str(mapping)), 1)

    def test_manual_map_missing_file_does_not_fall_back_to_drive(self):
        mapping = self.root / "images-map.json"
        mapping.write_text(json.dumps({"Joe": "absent.jpg"}))
        self.write_rows([{"name": "Joe", "image": "https://drive.google.com/file/d/abc/view"}])
        with patch.object(deck, "download_image", side_effect=AssertionError("must stay offline")):
            self.assertEqual(self.run_build("--image-map", str(mapping)), 2)
        self.assertEqual(self.cards(), [])

    def test_drive_login_redirect_has_clear_error(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.url = "https://accounts.google.com/v3/signin/identifier"
        response.__enter__.return_value = response
        session = MagicMock()
        session.get.return_value = response
        with self.assertRaisesRegex(deck.DeckError, "exige une connexion"):
            deck.download_image(session, "https://drive.google.com/file/d/abc/view", 5)
        response.iter_content.assert_not_called()


if __name__ == "__main__":
    unittest.main()
