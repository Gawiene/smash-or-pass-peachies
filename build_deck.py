#!/usr/bin/env python3
"""Préparer localement un deck depuis Excel ou un export JSON StreamElements."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO
import json
import logging
import math
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
import unicodedata
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
import warnings

try:
    import openpyxl
    from PIL import Image, ImageOps, UnidentifiedImageError
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError as exc:
    raise SystemExit(
        f"Dépendance manquante : {exc.name}. Lancez : python -m pip install -r requirements.txt"
    ) from exc


DEFAULT_BASE_URL = "https://gawiene.github.io/smash-or-pass-peachies/images/"
SHEET = "Préparation par carte"
HEADERS = ("Statut", "Nom final", "Provenance finale", "Crédit final", "Image finale")
MAX_BYTES = 30 * 1024 * 1024
FORMATS = {"JPEG", "PNG", "WEBP"}
LOG = logging.getLogger("deck")


class DeckError(ValueError):
    """Erreur explicable à l'utilisateur, sans traceback."""


def text(value):
    return "" if value is None else str(value).strip()


def slugify(name):
    value = name.lower().replace("œ", "oe").replace("æ", "ae").replace("ß", "ss")
    value = re.sub(r"['’‘ʼ`´]", "", value)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:140].rstrip("-")
    value = value or "carte"
    # Ces noms restent réservés sous Windows, même avec une extension.
    if re.fullmatch(r"con|prn|aux|nul|com[1-9]|lpt[1-9]", value):
        value = "carte-" + value
    return value


def drive_info(source):
    parsed = urlsplit(source)
    if parsed.hostname not in {"drive.google.com", "www.drive.google.com", "drive.usercontent.google.com", "docs.google.com"}:
        return None
    query = parse_qs(parsed.query)
    match = re.search(r"/file/(?:u/\d+/)?d/([\w-]+)", parsed.path)
    file_id = match.group(1) if match else query.get("id", [""])[0]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", file_id):
        raise DeckError("Lien Google Drive sans ID de fichier (un dossier n'est pas une image).")
    return file_id, query.get("resourcekey", [""])[0]


def source_identity(source, parent):
    info = drive_info(source)
    if info:
        return "drive:" + info[0]
    if urlsplit(source).scheme in {"http", "https"}:
        return source
    return str((parent / source).resolve())


def load_rows(path, sheet):
    """Renvoie les cartes sélectionnées et le nombre de lignes non sélectionnées."""
    if path.suffix.lower() == ".json":
        try:
            raw = json.loads(path.read_text(encoding="utf-8-sig"))
        except (ValueError, UnicodeError) as exc:
            raise DeckError(f"JSON invalide : {exc}") from exc
        rows = raw.get("cardsData") if isinstance(raw, dict) else raw
        if not isinstance(rows, list):
            raise DeckError('Le JSON doit être un tableau ou un objet {"cardsData": [...]}.')
        result = []
        for index, row in enumerate(rows, 1):
            if not isinstance(row, dict):
                result.append({"line": index, "name": "", "origin": "", "credit": "", "source": "", "error": "La carte doit être un objet JSON."})
                continue
            item = {key: text(row.get(field)) for key, field in (
                ("name", "name"), ("origin", "origin"), ("credit", "credit"), ("source", "image"))}
            item["line"] = index
            if any(row.get(field) is not None and not isinstance(row.get(field), str)
                   for field in ("name", "origin", "credit", "image")):
                item["error"] = "Les champs name/origin/credit/image doivent être du texte."
            result.append(item)
        return result, 0
    if path.suffix.lower() != ".xlsx":
        raise DeckError("Format attendu : .xlsx ou .json.")
    # Mode normal nécessaire pour lire aussi les cibles des hyperliens Excel.
    workbook = openpyxl.load_workbook(path, data_only=True, keep_links=False)
    try:
        if sheet not in workbook.sheetnames:
            raise DeckError(f"Feuille introuvable : {sheet}. Disponibles : {', '.join(workbook.sheetnames)}")
        ws = workbook[sheet]
        headers = [text(cell.value) for cell in ws[1]]
        missing = [name for name in HEADERS if name not in headers]
        duplicates = [name for name in HEADERS if headers.count(name) > 1]
        if missing or duplicates:
            raise DeckError(f"En-têtes invalides en ligne 1. Manquants : {missing} ; doublons : {duplicates}")
        columns = {name: headers.index(name) for name in HEADERS}
        result, ignored = [], 0
        for cells in ws.iter_rows(min_row=2):
            if all(cell.value is None for cell in cells):
                continue
            # Comparaison volontairement exacte : pas de strip ni de changement de casse.
            if cells[columns["Statut"]].value != "Prêt":
                ignored += 1
                continue
            image = cells[columns["Image finale"]]
            result.append({
                "line": cells[0].row,
                "name": text(cells[columns["Nom final"]].value),
                "origin": text(cells[columns["Provenance finale"]].value),
                "credit": text(cells[columns["Crédit final"]].value),
                "source": text(image.hyperlink.target if image.hyperlink else image.value),
            })
        return result, ignored
    finally:
        workbook.close()


class DriveForm(HTMLParser):
    """Seul un formulaire explicite de confirmation Drive est accepté."""

    def __init__(self):
        super().__init__()
        self.forms, self.current = [], None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form":
            self.current = {"action": attrs.get("action", ""), "method": attrs.get("method", "get").lower(), "params": {}}
        elif tag == "input" and self.current is not None and attrs.get("name"):
            if attrs.get("type", "").lower() == "hidden":
                self.current["params"][attrs["name"]] = attrs.get("value", "")

    def handle_endtag(self, tag):
        if tag == "form" and self.current is not None:
            self.forms.append(self.current)
            self.current = None


def confirmation_url(body, current_url, file_id):
    parser = DriveForm()
    parser.feed(body.decode("utf-8", errors="replace"))
    for form in parser.forms:
        action = urljoin(current_url, form["action"])
        parsed = urlsplit(action)
        params = dict(parse_qs(parsed.query))
        params = {key: val[0] for key, val in params.items()}
        params.update(form["params"])
        if (parsed.scheme == "https" and parsed.hostname in {"drive.google.com", "drive.usercontent.google.com"}
                and parsed.path in {"/download", "/uc"} and form["method"] == "get"
                and params.get("id") == file_id and "confirm" in params):
            return parsed._replace(query=urlencode(params), fragment="").geturl()
    return None


def download_image(session, source, timeout):
    parsed = urlsplit(source)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise DeckError("URL HTTP(S) invalide.")
    info = drive_info(source)
    if info:
        params = {"id": info[0], "export": "download"}
        if info[1]:
            params["resourcekey"] = info[1]
        current = "https://drive.usercontent.google.com/download?" + urlencode(params)
    else:
        current = source
    for attempt in range(2):
        with session.get(current, stream=True, timeout=(min(timeout, 10), timeout), allow_redirects=True) as response:
            response.raise_for_status()
            if info and urlsplit(response.url).hostname == "accounts.google.com":
                raise DeckError("Google Drive exige une connexion Google. Rendre le fichier accessible à toute personne disposant du lien, ou fournir l'image locale.")
            content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
            allowed = content_type.startswith("image/") or content_type in {"application/octet-stream", "application/binary"}
            html = content_type in {"text/html", "application/xhtml+xml"}
            if not allowed and not (html and info):
                raise DeckError(f"Content-Type refusé : {content_type or 'absent'} ; fournir un lien direct vers l'image.")
            limit = 512 * 1024 if html else MAX_BYTES
            chunks, size = [], 0
            for chunk in response.iter_content(64 * 1024):
                size += len(chunk)
                if size > limit:
                    raise DeckError(f"Réponse trop volumineuse (limite {limit // 1024} Ko).")
                chunks.append(chunk)
            body = b"".join(chunks)
            if html:
                next_url = confirmation_url(body, response.url, info[0]) if attempt == 0 else None
                if next_url:
                    current = next_url
                    continue
                raise DeckError("Google Drive renvoie du HTML : accès privé, quota ou confirmation non prise en charge. Vérifier le partage public.")
            if not body:
                raise DeckError("Réponse image vide.")
            if body.lstrip().lower().startswith((b"<!doctype html", b"<html")):
                raise DeckError("Page HTML reçue à la place de l'image malgré le Content-Type.")
            return body
    raise DeckError("Confirmation Google Drive impossible.")


def validate_image(path):
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(path) as image:
            if image.format != "WEBP":
                raise DeckError("Le fichier existant n'est pas un véritable WebP ; utiliser --force.")
            image.load()


def normalize_image(data, destination, max_size, quality):
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(BytesIO(data)) as original:
            if original.format not in FORMATS:
                raise DeckError(f"Format image non pris en charge : {original.format}. Attendu : JPEG, PNG ou WebP.")
            original.load()
            image = ImageOps.exif_transpose(original)
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
            # Le temporaire reste dans le même dossier : remplacement atomique sur Windows.
            handle, temporary = tempfile.mkstemp(prefix=".deck-", suffix=".webp", dir=destination.parent)
            os.close(handle)
            try:
                image.save(temporary, "WEBP", quality=quality, method=6)
                validate_image(temporary)
                Path(temporary).replace(destination)
            finally:
                Path(temporary).unlink(missing_ok=True)


def read_manifest(path):
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        entries = raw["entries"]
        if raw["version"] != 1 or not isinstance(entries, dict):
            raise ValueError("version ou entrées invalides")
        filenames = []
        for key, filename in entries.items():
            if not re.fullmatch(r"[a-f0-9]{64}:\d+", key) or not isinstance(filename, str) or not re.fullmatch(r"[a-z0-9-]+\.webp", filename):
                raise ValueError("entrée invalide")
            filenames.append(filename)
        if len(set(filenames)) != len(filenames):
            raise ValueError("noms de fichiers dupliqués")
        return entries
    except (ValueError, KeyError, TypeError) as exc:
        raise DeckError(f"Manifest invalide : {path}. Restaurer une sauvegarde avant de relancer ({exc}).") from exc


def read_image_map(path, rows):
    """Associer explicitement des téléchargements manuels aux sources originales."""
    if path is None:
        return {}
    path = path.expanduser().resolve()
    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise DeckError(f"Table de correspondance illisible : {path} ({exc})") from exc
    if not isinstance(raw, dict) or any(not isinstance(name, str) or not isinstance(value, str) or not value.strip()
                                        for name, value in raw.items()):
        raise DeckError('La correspondance doit être un objet {"Nom exact de carte": "chemin/image.jpg"}.')
    counts = Counter(row["name"] for row in rows)
    unknown = set(raw) - counts.keys()
    ambiguous = [name for name in raw if counts[name] > 1]
    if unknown or ambiguous:
        raise DeckError(f"Correspondances inconnues : {sorted(unknown)} ; noms ambigus : {ambiguous}.")
    return {name: (path.parent / filename).resolve() for name, filename in raw.items()}


def write_text_atomic(path, content, backup=False):
    if backup and path.exists() and path.read_bytes() != content.encode("utf-8"):
        folder = path.parent / ".build-backups"
        folder.mkdir(exist_ok=True)
        shutil.copy2(path, folder / f"{time.time_ns()}-{path.name}")
    handle, temporary = tempfile.mkstemp(prefix=".deck-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        Path(temporary).replace(path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def md(value):
    return str(value).replace("\\", "\\\\").replace("|", "\\|").replace("\r", " ").replace("\n", " ").replace("<", "&lt;").replace(">", "&gt;")


def report_text(source, rows, ignored, cards, outcomes, duplicates, manifest_path):
    excel = source.suffix.lower() == ".xlsx"
    lines = ["# Rapport de préparation du deck", "", f"Source : {md(source)}", "",
             f"Date : {datetime.now().astimezone().isoformat(timespec='seconds')}", "",
             f"- {'Lignes au statut exactement Prêt' if excel else 'Cartes sélectionnées dans le JSON'} : {len(rows)}",
             f"- Lignes hors statut Prêt : {ignored}" if excel else "- JSON : toutes les cartes fournies sont sélectionnées (aucun filtre Statut).",
             f"- Cartes générées : {len(cards)}",
             f"- Cartes sélectionnées ignorées : {sum(item['status'] == 'erreur' for item in outcomes)}",
             f"- Images créées : {sum(item['status'] == 'créée' for item in outcomes)}",
             f"- Images réutilisées : {sum(item['status'] == 'réutilisée' for item in outcomes)}", "",
             "## Cartes ignorées et erreurs", "", "| Ligne / carte | Nom | Source / URL problématique | Erreur |", "| --- | --- | --- | --- |"]
    if not cards:
        lines[2:2] = ["**Aucune carte exploitable : ne pas remplacer le deck du widget par les JSON vides. Corriger les sources puis relancer.**", ""]
    failures = [item for item in outcomes if item["status"] == "erreur"]
    lines.extend(f"| {item['line']} | {md(item['name'])} | {md(item['source'])} | {md(item['detail'])} |" for item in failures)
    if not failures:
        lines.append("| — | — | — | Aucune erreur |")
    lines.extend(["", "## Doublons et suffixes", ""])
    lines.extend(f"- {md(item)}" for item in duplicates)
    if not duplicates:
        lines.append("Aucun doublon de slug dans la sélection.")
    lines.extend(["", "## Images de cette exécution", "", "| Ligne / carte | Nom | Fichier | Résultat | Source locale utilisée |", "| --- | --- | --- | --- | --- |"])
    lines.extend(f"| {item['line']} | {md(item['name'])} | {md(item.get('filename', ''))} | {item['status']} | {md(item.get('local_source', ''))} |" for item in outcomes)
    lines.extend(["", "## Fichiers générés", "", "- cardsData.json", "- streamelements-data-snippet.json", "- build-report.md", f"- {manifest_path.name}", ""])
    lines.extend(f"- images/{item['filename']}" for item in outcomes if item["status"] == "créée")
    lines.extend(["", "## Contrôle avant publication", "", "Vérifier les images et les erreurs ci-dessus. Aucune publication, commande Git ou modification du widget n'a été effectuée.", "Les URL GitHub Pages ne fonctionneront qu'après publication manuelle des images sur ce dépôt.", ""])
    return "\n".join(lines)


def build(args):
    source = args.input.expanduser().resolve()
    if not source.is_file():
        raise DeckError(f"Fichier source introuvable : {source}")
    rows, ignored = load_rows(source, args.sheet)
    image_map = read_image_map(args.image_map, rows)
    output = args.output_dir.expanduser().resolve()
    if source in {output / name for name in ("cardsData.json", "streamelements-data-snippet.json", "build-manifest.json", "build-report.md")}:
        raise DeckError("Le fichier source porte le nom d'une sortie. Déplacer/renommer la source ou choisir --output-dir pour la conserver.")
    output.mkdir(parents=True, exist_ok=True)
    images = output / "images"
    images.mkdir(exist_ok=True)
    manifest_path = output / "build-manifest.json"
    entries = read_manifest(manifest_path)
    reserved = set(entries.values())
    occurrences, bases = Counter(), Counter()
    cards, outcomes, duplicates = [], [], []
    session = requests.Session()
    session.headers["User-Agent"] = "PeachiesDeckBuilder/1.0"
    retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504], allowed_methods={"GET"}, respect_retry_after_header=False)
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.mount("http://", HTTPAdapter(max_retries=retry))
    try:
        for row in rows:
            item = {**row, "status": "erreur", "detail": ""}
            try:
                if row.get("error"):
                    raise DeckError(row["error"])
                if not row["name"] or not row["source"]:
                    raise DeckError("Nom final/name ou Image finale/image manquant.")
                identity = json.dumps([row["name"], source_identity(row["source"], source.parent)], ensure_ascii=False)
                digest = sha256(identity.encode("utf-8")).hexdigest()
                occurrences[digest] += 1
                key = f"{digest}:{occurrences[digest]}"
                base = slugify(row["name"])
                bases[base] += 1
                if key not in entries:
                    filename, suffix = base + ".webp", 2
                    while filename in reserved:
                        filename = f"{base}-{suffix}.webp"
                        suffix += 1
                    entries[key] = filename
                    reserved.add(filename)
                    # Sauvegarder l'affectation avant toute image pour survivre à une interruption.
                    write_text_atomic(manifest_path, json.dumps({"version": 1, "entries": entries}, indent=2) + "\n")
                filename = entries[key]
                item["filename"] = filename
                if bases[base] > 1 or filename != base + ".webp":
                    duplicates.append(f"Ligne/carte {row['line']} : {row['name']} → {filename} (collision ou affectation conservée).")
                destination = images / filename
                local_override = image_map.get(row["name"])
                if local_override:
                    item["local_source"] = str(local_override)
                    if local_override == destination.resolve():
                        raise DeckError("L'image source locale est aussi la destination. Choisir un autre --output-dir pour conserver l'original.")
                if destination.exists() and not args.force:
                    validate_image(destination)
                    item["status"] = "réutilisée"
                else:
                    if not local_override and urlsplit(row["source"]).scheme in {"http", "https"}:
                        data = download_image(session, row["source"], args.timeout)
                    else:
                        local = local_override or (source.parent / row["source"]).resolve()
                        if not local.is_file():
                            raise DeckError(f"Image locale introuvable : {local}. Fournir ce fichier ou une URL directe.")
                        if local.stat().st_size > MAX_BYTES:
                            raise DeckError("Image locale supérieure à 30 Mo.")
                        data = local.read_bytes()
                    normalize_image(data, destination, args.max_size, args.quality)
                    item["status"] = "créée"
                cards.append({"name": row["name"], "origin": row["origin"], "credit": row["credit"], "image": args.base_url.rstrip("/") + "/" + filename})
                LOG.info("Carte/ligne %s — %s : %s (%s)", row["line"], row["name"], item["status"], filename)
            except (DeckError, OSError, ValueError, requests.RequestException, UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
                item["detail"] = str(exc)
                LOG.error("Carte/ligne %s — %s : %s | %s", row["line"], row["name"] or "(sans nom)", exc, row["source"])
            outcomes.append(item)
    finally:
        session.close()
    for name, data in (("cardsData.json", cards), ("streamelements-data-snippet.json", {"cardsData": cards}),
                       ("build-manifest.json", {"version": 1, "entries": entries})):
        write_text_atomic(output / name, json.dumps(data, ensure_ascii=False, indent=2) + "\n", backup=True)
    write_text_atomic(output / "build-report.md", report_text(source, rows, ignored, cards, outcomes, duplicates, manifest_path))
    errors = sum(item["status"] == "erreur" for item in outcomes)
    LOG.info("Terminé : %d/%d cartes, %d erreur(s). Rapport : %s", len(cards), len(rows), errors, output / "build-report.md")
    return 2 if errors else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Classeur .xlsx ou JSON (tableau ou objet cardsData)")
    parser.add_argument("--force", action="store_true", help="Retélécharger et remplacer les images existantes")
    parser.add_argument("--image-map", type=Path, help="JSON associant les noms exacts des cartes aux images téléchargées manuellement")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent, help="Dossier de sortie (défaut : dossier du script)")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="URL publique du dossier images/")
    parser.add_argument("--sheet", default=SHEET, help="Nom de la feuille Excel")
    parser.add_argument("--max-size", type=int, default=1600, help="Plus grand côté en pixels, sans agrandissement")
    parser.add_argument("--quality", type=int, default=85, help="Qualité WebP (1–100)")
    parser.add_argument("--timeout", type=float, default=30, help="Délai réseau en secondes par lecture")
    args = parser.parse_args(argv)
    if args.max_size < 1 or not 1 <= args.quality <= 100 or not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("--max-size et --timeout doivent être positifs ; --quality doit être compris entre 1 et 100.")
    base = urlsplit(args.base_url)
    if base.scheme not in {"http", "https"} or not base.hostname or base.query or base.fragment:
        parser.error("--base-url doit être une URL HTTP(S) de dossier, sans paramètres ni fragment.")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    try:
        return build(args)
    except (DeckError, OSError, ValueError, KeyError) as exc:
        LOG.error("Préparation impossible : %s", exc)
        return 1
    except KeyboardInterrupt:
        LOG.warning("Traitement interrompu. Les images déjà créées sont conservées ; relancer pour reprendre.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
