# Notes pour coder dans ce dépôt

Éditeur vidéo web (scènes + calques) sur Remotion. Monorepo pnpm, TypeScript strict.
Interface et commentaires en français.

## Règles d'architecture

- **Une seule composition** (`packages/composition`) sert à l'aperçu (`<Player>`) ET à
  l'export (`renderMediaOnWeb`). Ne jamais dupliquer de logique de rendu dans l'éditeur.
- **Le schéma fait foi** (`packages/schema`, Zod). Toute nouvelle donnée de projet passe
  par le schéma, avec une valeur par défaut pour rester compatible avec les anciens projets.
  Changement non rétrocompatible → incrémenter `version` et écrire une migration.
- Positions et tailles en **pixels de la composition** (ex. 1920×1080), jamais en pixels écran.
- Durées en **frames**. Conversion secondes ↔ frames via `secondsToFrames` / `framesToSeconds`.
- Le minutage des scènes (chevauchement des transitions) se calcule uniquement avec
  `getSceneTimings` / `getProjectDurationInFrames`.
- Modifs d'état via les actions de `useEditor` (Immer : on mute le brouillon).
  Seul `project` entre dans l'historique annuler/rétablir.

## Serveur et comptes

- Base `node:sqlite` (`apps/server/src/db.ts`). Changer le schéma = **ajouter** une
  migration à la fin de `MIGRATIONS`, jamais modifier une migration existante.
- Toute route sous `/api/projects`, `/api/assets`, `/api/videos`, `/api/templates` passe par
  `requireUser` ; chaque requête SQL filtre sur `user_id = c.var.user.id`.
- Les fichiers `/files/<nom>` ne sont servis qu'à leur propriétaire.
- `createApp()` (app.ts) est testable sans réseau : voir `app.test.ts`.

## Contraintes du rendu navigateur (export)

Le CSS supporté est limité : https://www.remotion.dev/docs/client-side-rendering/limitations
- pas de `z-index` → l'ordre DOM fait foi ;
- pas de `object-position`, `backdrop-filter`, `background-blend-mode`, masques SVG ;
- `clip-path` : polygon/path/circle/ellipse/inset seulement ;
- `mask-image` : dégradé linéaire ou image raster data:/blob: en `100% 100%`.
- Images via `<Img>` de `remotion`, audio/vidéo via `@remotion/media`.
- Pas de fond (background) sur un texte qui s'étale sur plusieurs lignes, et
  `background-size` n'est pas fiable : préférer de petits blocs positionnés
  (cf. le surligneur dans `TextLayerView.tsx`).
- Styles `border: double` non exporté (on dessine deux traits) ; les bordures des
  formes complexes sont un tracé SVG (`shapePath`), clippé par la forme.
- Les `<img>` de la composition doivent avoir `maxWidth: "none"` (Tailwind les
  limite sinon à leur cadre, ce qui empêche le recadrage).
- **Fonds** (`effects/backgrounds.tsx`) : l'export ne gère que les `linear-gradient` et un
  `radial-gradient` centré, sans couches multiples. Dégradés (radial décentré, animés) et
  motifs sont donc dessinés en `<svg>` (le navigateur le rastérise lui-même) ; le grain est un
  `<canvas>` de bruit à graine fixe. Ne pas repasser ces fonds en CSS `background-image`.
  L'ancien dégradé `{from, to}` est converti en `colors[]` à la lecture (schéma).
- **Formes** (`layers/ShapeLayerView.tsx`) : un `<svg>` avec `shapePath` (remplissage, dégradé,
  contour inséré de la moitié de son épaisseur), l'ombre est un `filter: drop-shadow` sur le
  conteneur. **Stickers** (`apps/editor/src/templates/stickers.ts`) : SVG 100×100 _sans texte_
  (une police ne s'exporte pas dans une image SVG), ajoutés comme calque photo `data:image/svg+xml`.
- **Animations de calque** (`effects/animations.ts`, calcul pur `computeAnimation`, testé) :
  `transform` + `opacity` + `filter: blur` (flou vers net) + `clip-path: inset` (volets). Un calque
  est démonté (`hidden`) avant `enterDelayInFrames` et à partir de `endAtFrame`. Le flou ne
  s'exporte pas sous Safari. Les frames sont relatives à la scène.
- **Transitions** (`effects/transitionPresentations.tsx`) : présentations Remotion faites à la main
  (opacité, `transform`, `clip-path` polygon/circle/inset ; `customTransitionFrame` est pur et testé).
  Ne pas utiliser les présentations WebGL de `@remotion/transitions` (dissolve, cross-zoom…).
  **Piège** : l'export applique `opacity` élément par élément, pas en groupe : sans précaution, le
  fond d'une scène qui se fond laisse voir la scène du dessous (fondu faux dès qu'il y a une photo).
  `OpacityGroupMarker` (1 px transparent en `mix-blend-mode`) force le rendu en groupe : à
  mettre dans tout conteneur de scène dont l'opacité est entre 0 et 1.
- **Vidéo** (`layers/VideoLayerView.tsx`) : `<Video>` de `@remotion/media` dans une `<Sequence>`
  qui démarre à `enterDelayInFrames` (la lecture commence à l'apparition du calque).
  **Piège** : l'export est « muet » par défaut s'il n'y a pas de piste audio — `exportVideo.ts`
  utilise `projectHasSound(project)` (musique OU vidéo non coupée) ; ne jamais le recalculer
  à la main, sinon le son des vidéos disparaît de l'export.
- Texte en dégradé : `background-clip: text` ; l'ombre passe alors par
  `filter: drop-shadow` (text-shadow passerait devant le dégradé).
  Tout nouvel effet doit être vérifié en exportant une vraie vidéo.

## Thème, format, cadence (`packages/schema/src/theme.ts`, `projectOps.ts`)

- Fonctions pures qui **mutent** le brouillon Immer, toutes testées : `applyTheme`,
  `resizeProject` / `resizeScene`, `retimeProject` / `retimeScene`, `adaptScene` (modèle
  enregistré → format + cadence du projet). **Tout nouveau champ en px** d'un calque ou d'un
  fond doit être ajouté à `resizeLayer`/`resizeScene`, **tout nouveau champ en frames** à
  `retimeScene`/`retimeProject`, et toute nouvelle couleur à un rôle de `applyThemeToScene`.
- Ce que le serveur relit (projets, vignettes de la liste, modèles) repasse par le schéma,
  pour que les anciennes données reçoivent les champs ajoutés depuis.
- Qualité d'export : `scale` de `renderMediaOnWeb` (`features/export/quality.ts`).

## Polices et styles de texte

- Catalogue des polices : `packages/composition/src/fonts.ts` (chargées à la demande,
  une graisse à la fois, via `ensureFont` qui bloque le rendu jusqu'au chargement).
- Styles prêts à l'emploi : `apps/editor/src/templates/textPresets.ts`.

## Poignées sur l'aperçu (`features/preview/`)

- `transformMath.ts` : géométrie pure et testée (redimensionnement qui garde le côté opposé fixe
  même sur un calque tourné, rotation, aimantation, curseurs). `SelectionOverlay.tsx` ne fait que
  brancher la souris dessus ; les poignées vivent dans le repère (tourné) du calque.

## Forme d'onde et piste audio

- `lib/waveform.ts` : pics calculés dans le navigateur (`decodeAudioData` sur un
  `OfflineAudioContext` à 8 kHz pour rester léger), mis en cache par URL ; calcul pur et testé.
  `components/WaveformCanvas.tsx` la dessine, `WaveformPicker.tsx` sert aux réglages.
- `features/storyboard/audioEdit.ts` : déplacer / couper un morceau (pur, testé). Couper un bord
  change `startFrame`, `durationInFrames` ET `trimStartFrames` ensemble ; la fin est plafonnée à
  la longueur du fichier.

## Nouvelle page : propositions de mise en page (`apps/editor/src/features/layouts/`)

- Pur et testé (`layouts.test.ts`) : `content.ts` (contenu, rôles des textes, `sceneToContent`
  pour « Changer de mise en page »), `fit.ts` (zones, grilles, photo/polaroid logés dans une
  case, police qui fait tenir une pile de textes **sans couper de mot**), `builder.ts`
  (`PageBuilder` : pose photos/textes/aplats aux couleurs du thème, note, animations ; les
  6 `LAYOUT_STYLES`), `library.ts` (`LAYOUTS`), `propose.ts` (classement + « tours » de styles).
- Une disposition ne pose que des calques existants : rien de nouveau à exporter. Elle ne doit
  pas sortir de l'image (le test le vérifie pour tous les formats), sauf un décor nommé « … déborde ».
- Les textes posés sur plusieurs lignes n'utilisent jamais `box` (export) : un aplat
  (`addPanel`) est placé derrière.
- `relayoutScene` remplace calques + fond et garde id, nom (sauf nom automatique), durée,
  transition. Le contenu relu garde l'ordre des photos (la mise en avant reste n° 1).

## Ajouter un type de calque

schéma (`layers.ts`) → rendu (`composition/src/layers/registry.tsx`) → réglages
(`editor/src/features/inspector/sections/` + `TYPE_SECTIONS`) → icône dans `SceneInspector` →
champs px dans `resizeLayer` / frames dans `retimeScene`. TypeScript signale la plupart des oublis
(pas `resizeLayer` ni `retimeScene` : à vérifier à la main).

## Vérifier avant de terminer

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Tous les paquets `remotion` / `@remotion/*` doivent rester à la **même version exacte**.
