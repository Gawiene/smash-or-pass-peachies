#!/usr/bin/env python3
"""Valider et préparer le widget, ses Fields, son deck et ses images pour Pages."""

import argparse
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit

BASE_URL = "https://gawiene.github.io/smash-or-pass-peachies/images/"
WIDGET_FILES = ("widget/widget.js", "widget/widget.css", "streamelements/loader.html", "streamelements/fields.json")


def prepare(source, destination, base_url=BASE_URL):
    source, destination = source.resolve(), destination.resolve()
    if destination == source or destination in source.parents:
        raise ValueError("La sortie doit être distincte du dossier du deck et de ses parents.")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f"Le dossier de publication doit être vide : {destination}")
    canonical = (source / "data/cardsData.json").is_file()
    cards_path = source / ("data/cardsData.json" if canonical else "cardsData.json")
    cards = json.loads(cards_path.read_text(encoding="utf-8"))
    if not isinstance(cards, list) or not cards:
        raise ValueError("Deck vide ou JSON incohérents.")
    if not canonical:
        snippet = json.loads((source / "streamelements-data-snippet.json").read_text(encoding="utf-8"))
        if snippet != {"cardsData": cards}:
            raise ValueError("JSON incohérents.")
    filenames = set()
    actual_names = {path.name for path in (source / "images").iterdir()}
    for card in cards:
        if not isinstance(card, dict) or any(not isinstance(card.get(key), str) for key in ("name", "origin", "credit", "image")):
            raise ValueError("Carte invalide.")
        filename = urlsplit(card["image"]).path.rsplit("/", 1)[-1]
        if (not re.fullmatch(r"[a-z0-9-]+\.webp", filename) or filename in filenames
                or card["image"] != base_url.rstrip("/") + "/" + filename):
            raise ValueError(f"URL incohérente ou fichier dupliqué : {card['image']}")
        image = source / "images" / filename
        if image.is_symlink() or not image.is_file() or filename not in actual_names:
            raise ValueError(f"Image absente ou casse incorrecte : {filename}")
        with image.open("rb") as stream:
            header = stream.read(12)
        if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            raise ValueError(f"Fichier non WebP : {filename}")
        filenames.add(filename)
    if canonical:
        for filename in WIDGET_FILES:
            path = source / filename
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"Fichier du widget absent : {filename}")
        fields = json.loads((source / "streamelements/fields.json").read_text(encoding="utf-8"))
        if not isinstance(fields, dict) or any(name in fields for name in ("cardsData", "cardImages", "cardNames", "cardsSource", "cardsJson")):
            raise ValueError("Les Fields ne doivent plus contenir le deck.")
        if "{{" in (source / "widget/widget.css").read_text(encoding="utf-8"):
            raise ValueError("Le CSS hébergé contient encore des placeholders StreamElements.")
    (destination / "images").mkdir(parents=True)
    for filename in sorted(filenames):
        shutil.copy2(source / "images" / filename, destination / "images" / filename)
    (destination / "data").mkdir()
    shutil.copy2(cards_path, destination / "data/cardsData.json")
    # Conserver les anciennes URL publiques des JSON de préparation.
    shutil.copy2(cards_path, destination / "cardsData.json")
    (destination / "streamelements-data-snippet.json").write_text(json.dumps({"cardsData": cards}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if canonical:
        for filename in WIDGET_FILES:
            target = destination / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / filename, target)
    (destination / ".nojekyll").touch()
    print(f"Publication préparée : {len(cards)} cartes et leurs images{' avec le widget et ses Fields' if canonical else ''}. Dossier : {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("."))
    parser.add_argument("--output-dir", type=Path, default=Path(".tmp/pages"))
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    try:
        prepare(args.source, args.output_dir, args.base_url)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Publication impossible : {exc}\n")


if __name__ == "__main__":
    main()
