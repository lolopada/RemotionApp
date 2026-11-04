# Montage — éditeur vidéo web façon Canva

Éditeur de montages vidéo par **scènes** (storyboard) et **calques**, basé sur
[Remotion](https://www.remotion.dev). L'aperçu et l'export utilisent **la même
composition React** : ce que tu vois est exactement ce qui est exporté.

Le serveur ne fait **aucun calcul vidéo**. Il gère les comptes et stocke les
projets, les médias et les vidéos exportées, c'est tout. L'encodage MP4 se fait dans le navigateur de l'utilisateur
(WebCodecs). Un petit serveur sans GPU suffit donc.

## Démarrer

Prérequis : Node 22.13 ou plus et pnpm (`corepack enable` suffit, la version est
fixée dans `package.json`).

```bash
pnpm install
pnpm dev          # éditeur http://localhost:5173 + API http://localhost:3001
```

Crée un compte (nom d'utilisateur + mot de passe, pas d'e-mail), puis
**Commencer avec la démo**. Importe des photos (onglet **Photos**), clique un
cadre puis une photo (ou glisse la photo sur le cadre), puis **Exporter MP4** :
la vidéo est téléchargeable tout de suite et gardée dans **Mes vidéos**.

| Commande         | Rôle                                                  |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | éditeur + serveur en mode développement               |
| `pnpm build`     | build de production de l'éditeur (`apps/editor/dist`) |
| `pnpm start`     | serveur de production (sert l'API **et** l'éditeur)   |
| `pnpm typecheck` | vérification TypeScript de tous les paquets           |
| `pnpm test`      | tests (Vitest)                                        |
| `pnpm lint`      | lint + format (Biome) ; `pnpm format` pour corriger   |

## La stack

| Besoin                  | Choix                                            | Pourquoi                                         |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Moteur vidéo            | **Remotion** (Player + `@remotion/web-renderer`) | une composition React pour l'aperçu et l'export  |
| Export                  | rendu **dans le navigateur** (WebCodecs)         | zéro charge serveur, pas de GPU nécessaire       |
| Transitions             | `@remotion/transitions`                          | 15 transitions, compatibles avec l'export        |
| Interface               | React 19 + Vite 8 + Tailwind 4                   | rapide, léger, standard                          |
| État + annuler/rétablir | Zustand + Immer + Zundo                          | simple, mutations lisibles, historique gratuit   |
| Format des projets      | **Zod** (`packages/schema`)                      | même validation côté éditeur et côté serveur     |
| Serveur                 | **Hono** sur Node                                | quelques Mo de RAM, API + fichiers statiques     |
| Comptes + données       | **SQLite intégré à Node** (`node:sqlite`)        | aucune dépendance, un seul fichier à sauvegarder |
| Mots de passe           | scrypt (`node:crypto`) + cookie de session       | standard, rien à installer                       |
| Qualité                 | TypeScript strict, Biome, Vitest                 | un seul outil pour lint + format, très rapide    |

## Structure

```
apps/
  editor/            Éditeur web (Vite + React)
    src/
      features/
        preview/     Aperçu : <Player>, sélection/déplacement, Smart Drop, lecture
        storyboard/  Vignettes des scènes (réordonner, dupliquer) + piste audio
        library/     Panneau gauche : modèles, éléments, photos, fonds, musique
        inspector/   Panneau droit : réglages scène / calque / musique
        export/      Export MP4 dans le navigateur, puis envoi au serveur
        topbar/      Nom du projet, état de sauvegarde, annuler/rétablir, export
        auth/        Connexion / création de compte
        home/        Mes projets (créer, renommer, dupliquer, supprimer) et Mes vidéos
        editor/      Page de l'éditeur
      store/         État Zustand, session, sauvegarde auto, raccourcis clavier
      lib/           API, mini-routeur, formats
      templates/     Modèles de scènes (titre, cadre cœur, duo, fin…)
      components/    Petits composants d'interface
  server/            API Hono
    src/
      auth/          Comptes, mots de passe, sessions, protections (CSRF, limite d'essais)
      routes/        /api/auth, /api/projects, /api/assets, /api/videos, /api/templates
      storage/       Projets et fichiers en SQLite + disque
      db.ts          Ouverture de la base et migrations
packages/
  schema/            Format JSON des projets (Zod) + fabriques + calcul du minutage
  composition/       Composition Remotion : scènes, calques, masques, animations, audio
data/                Créé au lancement (à sauvegarder, ignoré par git)
  montage.db         Comptes, sessions, projets, index des fichiers
  files/             Photos, musiques et vidéos exportées
```

### Le principe : un projet = un JSON

```
Project ─ width, height, fps
├─ scenes[]                  ← le storyboard
│   ├─ durationInFrames, background, transitionIn
│   └─ layers[]              ← dessinés dans l'ordre (fond → avant)
│       ├─ image  : src, masque (forme + bord flou), recadrage, bordure
│       ├─ text   : texte, police, couleur, contour…
│       └─ shape  : rectangle, rond, cœur
└─ audio[]                   ← musiques posées sur la timeline globale
```

Chaque calque a `transform` (position, taille, rotation, opacité) et `animation` :
16 entrées (fondu, zoom, pop, chute et rebond, rotation, retournement, flou vers net,
glissements depuis chaque côté, volets), 14 sorties symétriques, 4 boucles (flottement,
pulsation, balancement, rotation lente), 4 courbes de vitesse (douce, progressive,
linéaire, élastique), et le moment précis d'apparition / de disparition dans la scène
(durées affichées en secondes). Le zoom lent des photos peut aussi reculer ou glisser.

Chaque scène a une **transition d'entrée** (durée réglable) : aucune (coupe), fondu enchaîné,
fondu au noir, fondu au blanc, glissements ← → ↑, volets ← →, volet en diagonale, zoom avant,
zoom arrière, retournement, iris (cercle qui s'ouvre) et balayage d'horloge. Le bouton
« Appliquer à toutes les scènes » copie l'effet et la durée sur tout le storyboard
(annulable d'un seul coup).

Les textes ont en plus : 42 polices classées par style, graisse, italique, casse,
interligne, couleur unie ou dégradé, contour, ombre ou halo réglable, fond
(bandeau / arrondi / pastille), et une animation propre (machine à écrire, lettre
par lettre, mot par mot, surlignage). 14 styles prêts à l'emploi s'appliquent en
un clic (onglet Éléments).

Les photos ont : 11 formes de cadre (rectangle, arrondi, rond, cœur, étoile,
hexagone, losange, arche, bulle, nuage, timbre) avec bord flou, un mode polaroid
avec légende, une bordure (plein, tirets, points, double), une ombre portée,
8 filtres + luminosité/contraste/saturation/flou, le miroir, et un recadrage à la
souris (double-clic sur la photo : glisser pour cadrer, molette pour zoomer).
Tous les calques ont un mode de fusion (produit, écran, superposition…).

Les **vidéos** (onglet Vidéos, MP4 ou WebM) sont des calques comme les autres : forme de
cadre avec bord flou, miroir, zoom, ombre, filtres, animations d'entrée/sortie, rotation. Elles
démarrent quand le calque apparaît, avec un point de départ dans le fichier, une vitesse
(0,25× à 4×), un volume, un bouton muet et la boucle. « Caler la scène sur la vidéo » règle la
durée de la scène sur celle de la vidéo. Le son part dans le MP4 exporté.

**Sur l'aperçu**, le calque sélectionné a 8 poignées de redimensionnement et une poignée de
rotation. Coin = proportionnel (Maj : libre), Alt = depuis le centre, rotation aimantée tous
les 45° (Maj : pas de 15°). Un texte tiré par un coin change de taille de police. Le
déplacement s'aimante au centre et aux bords de l'image (Alt : sans aimantation).

**Musique et forme d'onde.** Chaque morceau de la piste sous le storyboard affiche sa forme
d'onde (avec le volume et les fondus). On le **glisse** pour le déplacer et on **tire ses bords**
pour couper le début ou la fin ; début et fin s'aimantent sur les changements de scène
(Alt : sans aimantation). Le panneau de réglages montre le fichier entier : la partie jouée est
claire, un clic sur la courbe choisit le point de départ. La même courbe sert à régler le début
de lecture d'une vidéo. La courbe est calculée dans le navigateur (aucun travail serveur) ;
au-delà de 120 Mo, ou sans piste audio lisible, elle n'est simplement pas affichée.

Les formes décoratives (15 : rectangle, arrondi, rond, cœur, étoile, hexagone, losange,
arche, bulle de BD, nuage, timbre, triangle, flèche, explosion, ligne) peuvent être
pleines, en dégradé (2 à 4 couleurs) ou vides, avec un contour (plein, tirets, points) et
une ombre portée. L'onglet Éléments propose aussi des formes prêtes à l'emploi (cadre
vide, bulle de BD…) et 34 stickers intégrés (dessins SVG, sans import). Un sticker est un
calque photo : il garde cadre, ombre, bordure, miroir et animations.

Les fonds de scène : couleur unie, dégradé de 2 à 6 couleurs (linéaire ou circulaire
avec centre et taille réglables), motif (pois, rayures, damier, quadrillage), ou photo
(flou + voile coloré plein / dégradé / vignette). Tous peuvent recevoir un grain de
pellicule, et être animés (dégradé qui ondule, motif qui défile, zoom lent sur la photo).
Une trentaine de préréglages sont dans l'onglet Fonds, avec aperçu animé au survol.

### Projet : thème, modèles, format

- **Thème** (onglet Thème) : une palette à 5 rôles (fond, fond 2, accent, titres, textes)
  et deux polices (titres / textes). Un clic sur un des 12 thèmes prêts à l'emploi, ou
  « Appliquer à toutes les scènes » après retouche, recolore d'un coup les fonds, les
  textes (le plus grand texte d'une scène est le titre), les formes, bandeaux et
  surlignages (`applyTheme`, `packages/schema/src/theme.ts`). Les photos ne changent pas.
  Les modèles de scènes et les textes simples ajoutés ensuite prennent le thème.
- **Mes modèles** : « Enregistrer comme modèle » (panneau de la scène) range la scène
  dans le compte (`/api/templates`). L'onglet Modèles les propose dans tous les projets,
  adaptés au format et à la cadence du projet ouvert (double-clic sur le nom pour renommer).
- **Format** (onglet Format) : 16:9, 9:16, 1:1, 4:5 (Instagram), 21:9, ou taille libre
  (pixels pairs, jusqu'à 3840). Les calques gardent leur place relative et sont mis à
  l'échelle pour tenir dans l'image ; un texte passe à la ligne plutôt que de rétrécir
  (`resizeProject`). **Cadence** 24, 30 ou 60 images/s, sans changer les durées (`retimeProject`).
- **Qualité d'export** (menu « Exporter MP4 ») : 720p, 1080p ou 4K. La vidéo est mise à
  l'échelle pour tenir dans 1280×720, 1920×1080 ou 3840×2160 (dans un sens ou dans
  l'autre) : un projet 4:5 sort en 2160×2700 en 4K, un 21:9 en 3840×1646.

### Ajouter un type de calque (ex. sticker animé)

1. `packages/schema/src/layers.ts` : son schéma, ajouté à `LayerSchema`.
2. `packages/composition/src/layers/` : son composant de rendu, ajouté au `registry`.
3. `apps/editor/src/features/inspector/sections/` : son panneau de réglages.

TypeScript refuse de compiler tant qu'une de ces trois étapes manque.

## Déploiement

`deploy/install.sh` installe tout dans une CT Debian/Ubuntu (Node, service systemd, sauvegardes), `deploy/smoke-test.mjs`
test l'instance de production de bout en bout, `montage-doctor` contrôle sa santé. Voir `docs/deploiement.md`.

## Comptes et sauvegarde

- **Comptes** : nom d'utilisateur (3 à 32 caractères) et mot de passe (8+). Pas
  d'e-mail, donc **pas de récupération de mot de passe** : un mot de passe perdu
  se réinitialise à la main en base. `ALLOW_SIGNUP=false` ferme les inscriptions
  (les comptes existants continuent de marcher).
- **Tout est privé** : chaque compte ne voit que ses projets, ses médias et ses
  vidéos ; même les URL des fichiers (`/files/…`) exigent la session du propriétaire.
- **Sauvegarde automatique** : chaque modification est copiée tout de suite sur
  l'appareil (brouillon local), puis envoyée au serveur après 1 s de calme
  (5 s maximum pendant une longue édition). En cas de coupure, l'éditeur réessaie
  tout seul ; si l'onglet est fermé avant l'envoi, le brouillon est récupéré à la
  réouverture. Le navigateur prévient si on ferme avec des changements non envoyés.
- **Vidéos** : chaque export est envoyé au serveur en flux (même les gros fichiers
  ne passent pas en mémoire) et rangé dans **Mes vidéos** (lecture, téléchargement).
- **Historique des versions** (bouton « Historique » dans l'éditeur) : une version
  automatique est gardée au plus toutes les 10 min d'édition, et à chaque reprise
  après une pause (les 50 dernières par projet). On peut aussi **nommer** l'état
  actuel (« avant les transitions ») : les versions nommées ne sont jamais
  supprimées. Chaque version a un aperçu jouable ; on peut la **restaurer**
  (l'état actuel est gardé d'abord, donc une restauration s'annule) ou la
  **copier dans un nouveau projet**. Les versions sont stockées compressées.
- Si deux onglets modifient le même projet, le dernier enregistré l'emporte
  (l'historique permet de récupérer l'autre version).

## Bon à savoir

**L'export exige un « contexte sécurisé ».** WebCodecs ne marche qu'en **HTTPS**
ou sur `localhost`. Sur ton serveur, mets un reverse proxy HTTPS devant (voir
`docs/deploiement.md`). En `http://192.168.x.x`, l'aperçu marche mais pas l'export.

**Navigateurs :** Chrome/Edge 94+, Firefox 130+, Safari 26+. Les filtres CSS
(flou de fond) ne s'exportent pas sous Safari.

**Limites du rendu navigateur de Remotion.** Seule une partie du CSS est
supportée : pas de `z-index` (l'ordre du tableau fait foi), pas de
`object-position` (le recadrage passe par `transform`), masques en `clip-path`
ou en image raster. Le bord flou des cadres est donc une image de masque générée
sur un canvas (`packages/composition/src/effects/masks.ts`). Liste complète :
<https://www.remotion.dev/docs/client-side-rendering/limitations>. Tout nouvel
effet doit être vérifié à l'export, pas seulement dans l'aperçu.

**Vidéos importées.** Le décodage passe par WebCodecs : le navigateur doit savoir lire le
codec. MP4 H.264 + AAC marche dans Chrome, Edge et Safari ; Chromium « libre » (sans codecs
propriétaires) ne lit que WebM VP9/Opus. Les fichiers `.mov` sont refusés à l'import.

**Polices.** Elles viennent de Google Fonts via `@remotion/google-fonts`. Pour
tout héberger toi-même, passe à `@remotion/fonts` avec des fichiers locaux.

**Licence Remotion.** Gratuite pour un particulier ou une structure de 3
personnes maximum, y compris en usage commercial. Au-delà, licence entreprise.
Le rendu navigateur envoie un événement de télémétrie par export (domaine, IP,
réussite ; aucun contenu). Voir <https://www.remotion.dev/docs/license>.

## Prochaines étapes

- [ ] Quota de stockage par compte
- [ ] Détourage IA : `rembg` sur le serveur (CPU) ou `transformers.js` dans le navigateur
- [ ] Export de secours côté serveur pour les navigateurs sans WebCodecs
