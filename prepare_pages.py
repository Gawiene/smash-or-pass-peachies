#!/usr/bin/env python3
"""Valider et préparer uniquement les images et JSON destinés à GitHub Pages."""

import argparse
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit

BASE_URL = "https://gawiene.github.io/smash-or-pass-peachies/images/"


def prepare(source, destination, base_url=BASE_URL):
    source, destination = source.resolve(), destination.resolve()
    if destination == source or destination in source.parents:
        raise ValueError("La sortie doit être distincte du dossier du deck et de ses parents.")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f"Le dossier de publication doit être vide : {destination}")
    cards = json.loads((source / "cardsData.json").read_text(encoding="utf-8"))
    snippet = json.loads((source / "streamelements-data-snippet.json").read_text(encoding="utf-8"))
    if not isinstance(cards, list) or not cards or snippet != {"cardsData": cards}:
        raise ValueError("Deck vide ou JSON incohérents.")
    filenames = set()
    for card in cards:
        if not isinstance(card, dict) or any(not isinstance(card.get(key), str) for key in ("name", "origin", "credit", "image")):
            raise ValueError("Carte invalide.")
        filename = urlsplit(card["image"]).path.rsplit("/", 1)[-1]
        if (not re.fullmatch(r"[a-z0-9-]+\.webp", filename) or filename in filenames
                or card["image"] != base_url.rstrip("/") + "/" + filename):
            raise ValueError(f"URL incohérente ou fichier dupliqué : {card['image']}")
        image = source / "images" / filename
        if image.is_symlink() or not image.is_file() or filename not in {path.name for path in image.parent.iterdir()}:
            raise ValueError(f"Image absente ou casse incorrecte : {filename}")
        with image.open("rb") as stream:
            header = stream.read(12)
        if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            raise ValueError(f"Fichier non WebP : {filename}")
        filenames.add(filename)
    (destination / "images").mkdir(parents=True)
    for filename in sorted(filenames):
        shutil.copy2(source / "images" / filename, destination / "images" / filename)
    for filename in ("cardsData.json", "streamelements-data-snippet.json"):
        shutil.copy2(source / filename, destination / filename)
    (destination / ".nojekyll").touch()
    print(f"Publication préparée : {len(cards)} cartes, {len(filenames)} images. Dossier : {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("deck"))
    parser.add_argument("--output-dir", type=Path, default=Path(".tmp/pages"))
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    try:
        prepare(args.source, args.output_dir, args.base_url)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Publication impossible : {exc}\n")


if __name__ == "__main__":
    main()
