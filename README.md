# Smash or Pass Peachies

Outil local pour préparer les images et les données du widget StreamElements.
Le JSON fourni (64 cartes) est conservé dans `data/cardsData-source.json`.
Il peut être utilisé directement : aucun CSV ou Excel n'est nécessaire.

## Images téléchargées manuellement : ton deck actuel

Les 64 images que tu as enregistrées sont dans `images/`. La table
`data/local-images.json` associe chaque nom de carte à son fichier original.
Elle permet de préparer le deck entièrement hors connexion, sans retourner
sur Google Drive. Le JSON source et les images originales sont conservés.

Depuis le terminal PowerShell du projet :

```powershell
.\.venv\Scripts\python.exe build_deck.py data/cardsData-source.json --image-map data/local-images.json --output-dir deck
```

**Les sorties actuelles à utiliser sont dans `deck/`** : `cardsData.json`,
`streamelements-data-snippet.json`, `build-report.md` et `images/` (WebP normalisés).
Les fichiers de sortie à la racine proviennent du premier essai sans accès Drive.
Le dépôt cible est `Gawiene/smash-or-pass-peachies`. Le workflow GitHub Pages
publie les images de `deck/images/` dans `/images/` à la racine du site.
Les URL du snippet sont donc bien de la forme
`https://gawiene.github.io/smash-or-pass-peachies/images/joe.webp`.

Les chemins de la table sont relatifs au dossier contenant cette table.
Les noms de carte doivent correspondre exactement au JSON source. Corriger la
table si tu remplaces ou renommes un téléchargement. Le rapport indique pour
chaque carte le fichier local utilisé. Les liens d'origine restent inchangés
et l'affectation des noms WebP reste stable. Une entrée locale manquante est
signalée sans tenter de retélécharger ce fichier sur Drive.

## Installation dans VS Code

Ouvrir ce dossier, puis un terminal PowerShell. Installer Python 3.10 ou plus récent
si nécessaire (cocher « Add Python to PATH » lors de l'installation sous Windows).

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Si Python est déjà installé mais que `python` n'est pas reconnu, essayer `py`
pour la première commande. Dans VS Code, sélectionner ensuite l'interpréteur
`.venv\Scripts\python.exe` avec « Python: Select Interpreter ».

## Utiliser ton JSON

```powershell
.\.venv\Scripts\python.exe build_deck.py data/cardsData-source.json
```

Avec l'environnement activé ou les dépendances déjà installées :

```powershell
python build_deck.py data/cardsData-source.json
python build_deck.py data/cardsData-source.json --force
```

Deux formes de JSON sont acceptées : `{"cardsData": [...]}` ou directement `[...]`.
Chaque carte utilise `name`, `origin`, `credit`, `image`. `name` et `image` sont
obligatoires ; les autres champs absents ou `null` deviennent `""`.
**Toutes les cartes du JSON sont sélectionnées**, puisqu'il ne contient pas de statut.
Le fichier source reste intact. Ne pas l'appeler comme une sortie dans le même
dossier, par exemple `cardsData.json` : le script refuse de remplacer sa source.

## Utiliser le classeur Excel

```powershell
python build_deck.py "C:/chemin/Smash_or_Pass_preparation_par_carte.xlsx"
python build_deck.py "C:/chemin/fichier.xlsx" --force
```

Feuille par défaut : `Préparation par carte`. Les en-têtes doivent être en ligne 1 :

| Statut | Nom final | Provenance finale | Crédit final | Image finale |
| --- | --- | --- | --- | --- |
| Prêt | Nicholas Galitzine | Films | Lucepeach | https://… |

Seul le statut **exactement** `Prêt` est traité. `prêt`, `Prêt ` et les autres
statuts sont ignorés. Les noms et images manquants sont signalés par numéro de
ligne sans bloquer les autres cartes. Les en-têtes manquants ou dupliqués bloquent
le lancement, pour éviter de produire un deck erroné.

Les hyperliens Excel sont lus via leur cible, même si le texte affiché est
« Voir l'image ». Les formules sont lues via leur dernière valeur calculée :
ouvrir, recalculer et enregistrer le classeur dans Excel avant l'import.
Le script ne calcule pas les formules et n'exécute pas de formule HYPERLINK.

## Images et options

- Liens Drive acceptés : `/file/d/ID/view`, `/open?id=ID`, `/uc?id=ID`,
  et liens de téléchargement `drive.usercontent.google.com/download?id=ID`.
  Les clés `resourcekey` sont transmises. Le fichier doit être accessible
  publiquement. Les redirections et les formulaires GET de confirmation de
  téléchargement Drive sont gérés ; connexion privée, quota dépassé et autres
  pages HTML sont signalés. Aucune connexion Google n'est effectuée.
- Autres sites : fournir une URL directe JPEG, PNG ou WebP. Une page Reddit
  contenant une image n'est pas une URL directe : remplacer le lien par celui
  de l'image (souvent `i.redd.it`), ou enregistrer l'image localement.
- Fichiers locaux : chemins absolus ou relatifs au **dossier du fichier source**.
  Le fichier mentionné pour Niall Horan doit donc être placé dans `data/` si
  tu conserves ton JSON à cet endroit, ou remplacé par une URL accessible.
- Vérification du Content-Type et décodage réel par Pillow. Les réponses binaires
  génériques sont acceptées uniquement si elles contiennent une vraie image.
  Limite de téléchargement : 30 Mo. Les fichiers invalides sont exclus du deck.
- WebP, qualité 85, grand côté limité à 1600 px, ratio et transparence conservés,
  rotation EXIF appliquée, aucune image agrandie. Une image animée est aplatie
  sur sa première image. Les métadonnées EXIF ne sont pas conservées.

```powershell
python build_deck.py data/cardsData-source.json --output-dir apercu --quality 85 --max-size 1600
python build_deck.py data/cardsData-source.json --base-url "https://gawiene.github.io/smash-or-pass-peachies/images/"
python build_deck.py fichier.xlsx --sheet "Préparation par carte" --timeout 30
```

Sans `--output-dir`, les sorties sont placées à côté du script, quel que soit
le dossier depuis lequel la commande est lancée. La base URL désigne le dossier
public `images/`, pas la racine du site.

## Relancer sans perdre les corrections

Les WebP existants et valides sont réutilisés sans modification par défaut.
Un fichier invalide est signalé, pas écrasé silencieusement. Utiliser `--force`
pour retélécharger et remplacer les images. En cas d'échec, l'ancien fichier
reste sur disque mais la carte concernée est exclue du JSON de cette exécution.
Aucune image n'est supprimée automatiquement.

`build-manifest.json` mémorise les affectations nom/source → fichier. **Conserver
ce fichier avec les images.** Il évite d'intervertir les images de deux noms
identiques lors d'un réordonnancement. Les nouveaux slugs reçoivent `-2`, `-3`,
etc. Les anciennes affectations restent réservées, même si une carte est retirée.
Changer le nom ou la source d'une carte peut donc attribuer un nouveau suffixe.
Lors du premier lancement sans manifest, les images déjà présentes avec le nom
attendu sont adoptées : vérifier leur correspondance dans le contrôle manuel.
Ne pas lancer deux préparations simultanément dans le même dossier de sortie.

Les JSON sont régénérés à chaque exécution. S'ils ont changé, leur version
précédente est copiée dans `.build-backups/` avant remplacement. Modifier de
préférence le **JSON source** ou le classeur, car les corrections dans les JSON
générés seront remplacées à la prochaine exécution. Le rapport est remplacé.

Codes de sortie : `0` = succès sans erreur de carte ; `2` = deck partiel avec
erreurs détaillées ; `1` = erreur bloquante ; `130` = interruption clavier.
Les sorties ne sont pas régénérées si le fichier source ou la configuration
est invalide. Les fichiers sont remplacés individuellement de manière atomique.

## Contrôle manuel et publication

Après chaque exécution :

1. Lire `build-report.md` (cartes exclues, URLs problématiques, collisions et fichiers).
2. Examiner les images dans `images/`, corriger les sources puis relancer au besoin.
3. Vérifier `cardsData.json` (tableau) et `streamelements-data-snippet.json`
   (objet avec la propriété `cardsData`).
4. Après contrôle, committer et pousser les changements de `deck/` sur `main`
   dans `Gawiene/smash-or-pass-peachies`. Le workflow publie automatiquement les
   images normalisées et les deux JSON. Attendre la réussite du déploiement
   dans GitHub Actions et vérifier une URL d'image avant de mettre à jour le widget.
5. Copier la propriété `cardsData` du snippet dans l'onglet Data de StreamElements,
   en conservant les autres propriétés éventuelles du widget et un JSON valide.

Le script de préparation ne pousse rien vers GitHub et ne modifie pas StreamElements.
Un push de `deck/` sur `main` déclenche la publication. Créer les fichiers
localement ne suffit pas à les rendre accessibles sur GitHub Pages.

## Hébergement GitHub Pages

Dépôt : https://github.com/Gawiene/smash-or-pass-peachies

Dans **Settings → Pages → Build and deployment → Source**, sélectionner
**GitHub Actions**. Le workflow `.github/workflows/pages.yml` publie le contenu
préparé par `prepare_pages.py` : uniquement les 64 WebP référencés (ou le nombre
de cartes du prochain deck), les deux JSON et `.nojekyll`. Les téléchargements
originaux, le rapport et le manifest ne sont pas inclus dans le site Pages.

La préparation vérifie les URL, la présence des images et la casse exacte des
noms avant d'envoyer le site. Le fichier `deck/images/joe.webp` est publié comme
`/smash-or-pass-peachies/images/joe.webp`, sans le segment `deck/` dans l'URL.

Vérification locale du contenu à déployer (dossier de sortie vide nécessaire) :

```powershell
.\.venv\Scripts\python.exe prepare_pages.py --output-dir .tmp/pages
```

GitHub Pages nécessite une offre compatible pour les dépôts privés. Avec
GitHub Free, le dépôt doit être public. La préparation et le workflow ne
changent jamais automatiquement la visibilité du dépôt.

## Vérifications automatiques

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Les tests utilisent des fichiers et un serveur HTTP temporaires ; ils ne
modifient pas ton deck et ne nécessitent pas de compte Google.

Références des bibliothèques : [openpyxl](https://openpyxl.readthedocs.io/en/stable/api/openpyxl.reader.excel.html),
[Pillow](https://pillow.readthedocs.io/en/stable/reference/ImageOps.html),
[Requests](https://requests.readthedocs.io/en/latest/user/quickstart/).
