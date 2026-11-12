# Smash or Pass Peachies

Widget StreamElements pour Twitch. GitHub Pages héberge le HTML injecté par le
JavaScript, le CSS, le deck et les images. La streameuse copie seulement un petit
loader HTML et les Fields dans un Custom Widget. Aucun jeton d'overlay n'est
nécessaire dans le dépôt ou dans le loader.

URL du projet : **https://gawiene.github.io/smash-or-pass-peachies/**

## 1. Activer GitHub Pages et publier

Dans le dépôt `Gawiene/smash-or-pass-peachies` :

1. Ouvrir **Settings → Pages**.
2. Dans **Build and deployment → Source**, choisir **GitHub Actions**.
3. Après contrôle des changements locaux, les committer et les pousser sur `main`.
4. Attendre la réussite du workflow **Publier le widget Smash or Pass Peachies**
   dans l'onglet **Actions**. Il est aussi lançable avec **Run workflow**.

Le dépôt est déjà public et Pages a déjà été activé pour les images. Cette
migration doit encore être poussée manuellement pour publier le JavaScript,
le CSS et la nouvelle URL du deck. Aucun push n'est effectué par les scripts locaux.

Le workflow valide les références des cartes et prépare uniquement les fichiers
nécessaires au widget. Les originaux, les rapports, les tests et les outils de
préparation ne sont pas copiés dans le site Pages.

Après publication, ces URL doivent répondre :

- [JavaScript du widget](https://gawiene.github.io/smash-or-pass-peachies/widget/widget.js)
- [CSS du widget](https://gawiene.github.io/smash-or-pass-peachies/widget/widget.css)
- [Deck JSON](https://gawiene.github.io/smash-or-pass-peachies/data/cardsData.json)
- [Exemple d'image](https://gawiene.github.io/smash-or-pass-peachies/images/joe.webp)

## 2. Installer dans StreamElements

1. Dans le compte StreamElements relié à la chaîne Twitch de la streameuse,
   créer ou ouvrir un overlay, puis ajouter **Static / Custom → Custom Widget**.
2. Ouvrir **Open Editor**. Dans **HTML**, remplacer tout le contenu par celui de
   [`streamelements/loader.html`](streamelements/loader.html).
3. Dans **Fields**, remplacer tout le contenu par celui de
   [`streamelements/fields.json`](streamelements/fields.json).
4. Laisser **CSS** et **JS** vides : leurs anciennes versions doivent être retirées
   pour éviter d'exécuter le jeu deux fois. Aucun `css.txt` ou `js.txt` n'est nécessaire.
5. Ne plus copier de deck dans **Data**. Sur un widget existant, retirer seulement
   l'ancienne propriété `cardsData` si elle y reste ; conserver les autres valeurs
   de configuration des Fields.
6. Donner au widget environ **600 × 900 px**, le placer dans l'overlay, puis
   enregistrer. Ajuster la taille selon la scène ; le debug demande un peu plus de hauteur.

Le loader contient les liens CSS/JS et une petite capture des événements avant
le téléchargement du script externe. **Copier le fichier complet**, même s'il
est légèrement plus long que deux balises. Il évite de perdre `onWidgetLoad`
si GitHub répond plus lentement que StreamElements.

Le JavaScript crée lui-même tout le HTML d'origine. Les scripts restent dans le
Custom Widget et utilisent directement son `SE_API` ; aucun iframe n'est ajouté.
Les couleurs sont appliquées depuis les Fields par des variables CSS, sans
placeholders `{{...}}` dans les fichiers hébergés.

## 3. Ajouter l'overlay dans OBS

Dans StreamElements, copier **l'URL de l'overlay**, puis dans OBS :

1. Ajouter une source **Navigateur** à la scène.
2. Coller l'URL de l'overlay StreamElements et utiliser ses dimensions,
   par exemple **1920 × 1080** pour un overlay Full HD.
3. Placer la source et vérifier le widget dans OBS.

L'URL à coller dans OBS est celle de StreamElements : elle fournit les événements
Twitch et `SE_API.store`. L'URL GitHub Pages sert les fichiers du widget.
L'URL personnelle de l'overlay reste dans OBS ; ne pas la publier dans GitHub.

### Si le swipe paraît moins fluide dans OBS

Dans **Sources**, faire clic droit sur la source **Navigateur** de l'overlay,
puis **Propriétés**. Vérifier **Utiliser une fréquence d'images personnalisée**
et **FPS** : OBS indique 30 FPS par défaut pour une source navigateur.
Pour une sortie OBS à 60 FPS, tester aussi la source à **60 FPS**. Si la sortie
OBS reste à 30 FPS, le rendu final reste limité à 30 images par seconde.

Après une mise à jour publiée, utiliser **Actualiser le cache de la page actuelle**
dans ces propriétés. Le CSS prépare la composition de la carte et coupe les
flous d'arrière-plan pendant le swipe ; leur aspect au repos est conservé.
Ces ajustements n'affectent ni les Fields, ni les votes, ni la synchronisation.
Le gain réel dépend du rendu et de la charge d'OBS et doit être vérifié dans OBS.

Référence : [propriétés des sources navigateur OBS](https://obsproject.com/kb/browser-source).

## 4. Jouer et tester

Les viewers écrivent **`smash`** ou **`pass`** dans le chat, sans point d'exclamation.
Chaque viewer a un seul vote par carte et peut le modifier en envoyant l'autre mot.
Les phrases contenant simplement ces mots ne comptent pas. Comme dans le widget
d'origine, les espaces autour et la casse sont normalisés.

Le streamer écrit **`!smash`** ou **`!pass`**. Seul le badge broadcaster permet
de déclencher ces commandes ; les viewers ne peuvent pas choisir à sa place.
Le résultat streamer/chat apparaît, puis la carte effectue son swipe et la
suivante arrive automatiquement. Le récapitulatif s'affiche à la fin.

Les Fields conservent :

**Les Fields sont obligatoires.** Tous les contrôles administratifs sont créés
par `streamelements/fields.json` dans StreamElements. Le JavaScript hébergé lit
leurs valeurs via `onWidgetLoad` et reçoit leurs boutons via `event:test` ou
`widget-button`. Ils conservent les noms, labels, groupes et valeurs d'origine.

- Toutes les couleurs du widget, de la photo, du résultat, du récap et du debug.
- Le debug optionnel, caché par défaut.
- Les six boutons de test de vote des trois viewers, avec changement de vote.
- Les boutons **Streamer : Smash** et **Streamer : Pass**.
- **Carte suivante**, **Recommencer le deck**, et l'ordre **normal / aléatoire**.

Pour tester, ouvrir simultanément l'éditeur StreamElements et la source OBS du
**même overlay**, utiliser les boutons de test, puis vérifier les deux affichages.
Faire ensuite un essai avec les messages Twitch et le compte broadcaster.

## Synchronisation et chargement

La clé `SE_API.store` **`smashorpassv3`**, la version d'état **3**, les données
de votes/résultats et le mélange déterministe du widget d'origine sont conservés.
Les événements `message`, `kvstore:update`, `event:test` et `widget-button` sont
tous pris en charge. Les événements arrivant pendant le chargement du deck
sont mis en attente, puis rejoués une fois l'état restauré.

Recharger l'éditeur ou OBS reprend la session enregistrée, même si le deck est
terminé. Pour démarrer une nouvelle partie, utiliser **Recommencer le deck**
dans les Fields : les résultats et votes sont vidés, la première carte revient
et le nouveau paquet est synchronisé entre les instances. En ordre aléatoire,
ce bouton effectue un nouveau mélange partagé. Un simple rechargement de page
ne remplace pas ce bouton et ne doit pas effacer une partie en cours dans OBS.

Le deck vient exclusivement de `data/cardsData.json` sur GitHub Pages. En cas
d'erreur réseau ou de JSON invalide, le widget utilise la dernière version valide
mémorisée localement si le sandbox permet ce cache, avec un message visible.
Sans cache, il affiche **Deck indisponible** et un bouton **Réessayer** : aucune
carte fictive et aucun état vide ne sont écrits dans le store. Le chargement
réseau est limité à dix secondes avant cette récupération.

Un changement de deck change sa signature et démarre une nouvelle session.
L'éditeur et OBS doivent donc recharger la même version du deck après une mise
à jour. Le cache facultatif est propre à chaque navigateur.

Les deux photos suivantes sont préchargées. Une carte revient au centre avec
sa nouvelle image et ses textes ensemble, après décodage de la photo. Si une
image échoue ou dépasse dix secondes de chargement, le fond neutre est affiché
et le debug signale l'erreur, sans conserver la photo de la carte précédente.

## Mise à jour

1. Remplacer ou modifier **`data/cardsData.json`**. C'est le deck utilisé par le
   widget ; ne plus modifier le Data StreamElements pour ajouter des cartes.
2. Ajouter les nouvelles images **WebP** dans **`images/`**, avec des noms en
   minuscules sans espaces, par exemple `nouveau-personnage.webp`.
3. Pour chaque carte, utiliser une URL complète respectant exactement la casse :

   ```json
   {
     "name": "Nouveau personnage",
     "origin": "Sa provenance",
     "credit": "Pseudo",
     "image": "https://gawiene.github.io/smash-or-pass-peachies/images/nouveau-personnage.webp"
   }
   ```

4. Contrôler le JSON et les images, puis committer et pousser les fichiers
   modifiés sur `main`. Le workflow republie le widget automatiquement.
5. Après réussite du workflow, rafraîchir l'éditeur et la source Navigateur OBS
   pour charger le nouveau deck. Aucun nouveau collage HTML/Fields n'est requis
   pour une simple modification du deck.

Pour une mise à jour du code ou du CSS qui paraît rester en cache, rafraîchir
le cache de la source Navigateur OBS. On peut aussi ajouter le même paramètre
`?v=2` aux deux URL CSS/JS dans le loader, puis réenregistrer le widget.

Le loader actuel utilise `widget.js?v=startup-2` pour forcer le chargement de la
version qui réinstalle le widget après remplacement du HTML. Publier d'abord
les changements du JavaScript et du loader, puis, si le changement ne se voit pas,
recopier le loader complet dans **HTML** du Custom Widget StreamElements,
enregistrer l'overlay, puis recharger sa source navigateur dans OBS ou Streamlabs
Desktop. Conserver les Fields et les valeurs de configuration. La modification
du fichier local ne met pas à jour automatiquement le HTML collé dans StreamElements.

Le contenu du widget est injecté à l'emplacement du loader, dans son conteneur
StreamElements. Remplacer le HTML réinstalle l'affichage et reprend les derniers
Fields connus, même si l'éditeur conserve la même fenêtre entre deux changements.

## Fichiers utiles

```text
images/                         WebP utilisés par le widget
data/cardsData.json             Deck de référence
widget/widget.js                Jeu, HTML injecté et synchronisation
widget/widget.css               Style d'origine et couleurs par défaut
streamelements/loader.html       À copier dans HTML
streamelements/fields.json       À copier dans Fields
prepare_pages.py                Validation et préparation de la publication
.github/workflows/pages.yml      Déploiement GitHub Pages
```

Les 64 téléchargements d'origine restent dans `data/original-images/`.
`data/local-images.json` les associe aux noms des cartes. `deck/` et les JSON
de préparation à la racine restent disponibles pour l'ancien outillage, mais
**le widget utilise seulement `data/cardsData.json` et `images/`**.
Le site publié conserve aussi les anciennes URL publiques `/cardsData.json`
et `/streamelements-data-snippet.json` pour compatibilité.

L'ancien outil Excel/JSON reste utilisable pour préparer des ajouts :

```powershell
python -m pip install -r requirements.txt
python build_deck.py data/cardsData-source.json --image-map data/local-images.json --output-dir deck
```

Pour importer ce résultat dans le widget, copier ensuite `deck/cardsData.json`
vers `data/cardsData.json` et les WebP concernés de `deck/images/` vers `images/`,
après contrôle. Pour Excel, remplacer le premier chemin par celui du classeur ;
seules les lignes exactement au statut `Prêt` sont importées. Les options
`--force`, `--base-url`, `--max-size` et `--quality` restent disponibles.

## Vérifications locales

Préparer les fichiers à déployer dans un **nouveau dossier vide** :

```powershell
python prepare_pages.py --output-dir .tmp/pages-verification
```

Les tests JavaScript simulent StreamElements et deux instances du widget avec
un store partagé, sans accéder à un overlay privé. Ils vérifient les votes,
les commandes, les timings, le récap, les événements précoces, le mélange,
la restauration et le fallback réseau. Avec Node.js 24 et les outils habituels :

```powershell
npm install
npm test
python -m unittest discover -s tests -v
```

Ces simulations doivent être complétées par le test StreamElements/OBS décrit
plus haut ; aucune session réelle n'est considérée validée par les seuls tests.

Références officielles : [événements StreamElements](https://docs.streamelements.com/overlays/events),
[structure et Fields](https://docs.streamelements.com/overlays/widget-structure),
[SE_API.store](https://github.com/StreamElements/widgets/blob/master/docs/CustomWidget.md).
