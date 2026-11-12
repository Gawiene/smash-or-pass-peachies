import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from prepare_pages import BASE_URL, prepare


class PagesTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "deck"
        self.output = self.root / "public"
        (self.source / "images").mkdir(parents=True)
        Image.new("RGB", (8, 8)).save(self.source / "images/joe.webp", "WEBP")
        self.cards = [{"name": "Joe", "origin": "", "credit": "", "image": BASE_URL + "joe.webp"}]
        self.write_json()

    def write_json(self):
        (self.source / "cardsData.json").write_text(json.dumps(self.cards), encoding="utf-8")
        (self.source / "streamelements-data-snippet.json").write_text(json.dumps({"cardsData": self.cards}), encoding="utf-8")

    def test_publishes_only_assets_with_expected_public_paths(self):
        (self.source / "build-report.md").write_text("private report")
        (self.source / "build-manifest.json").write_text("{}")
        (self.source / "images/unused.jpg").write_bytes(b"unused original")
        prepare(self.source, self.output)
        files = {path.relative_to(self.output).as_posix() for path in self.output.rglob("*") if path.is_file()}
        self.assertEqual(files, {"images/joe.webp", "cardsData.json", "streamelements-data-snippet.json", ".nojekyll"})

    def test_rejects_missing_or_wrong_case_image(self):
        (self.source / "images/joe.webp").rename(self.source / "images/Joe.webp")
        with self.assertRaisesRegex(ValueError, "absente ou casse"):
            prepare(self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_rejects_wrong_repository_url(self):
        self.cards[0]["image"] = "https://gawiene.github.io/twitch/images/joe.webp"
        self.write_json()
        with self.assertRaisesRegex(ValueError, "URL incohérente"):
            prepare(self.source, self.output)

    def test_rejects_inconsistent_json(self):
        (self.source / "streamelements-data-snippet.json").write_text('{"cardsData": []}')
        with self.assertRaisesRegex(ValueError, "JSON incohérents"):
            prepare(self.source, self.output)

    def test_preserves_existing_output_and_source(self):
        self.output.mkdir()
        saved = self.output / "keep.txt"
        saved.write_text("manual correction")
        with self.assertRaisesRegex(ValueError, "doit être vide"):
            prepare(self.source, self.output)
        self.assertEqual(saved.read_text(), "manual correction")
        with self.assertRaisesRegex(ValueError, "distincte"):
            prepare(self.source, self.source)


if __name__ == "__main__":
    unittest.main()
