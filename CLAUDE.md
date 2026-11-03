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
- Toute route sous `/api/projects`, `/api/assets`, `/api/videos` passe par
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
  Tout nouvel effet doit être vérifié en exportant une vraie vidéo.

## Ajouter un type de calque

schéma (`layers.ts`) → rendu (`composition/src/layers/registry.tsx`) → réglages
(`editor/src/features/inspector/sections/` + `TYPE_SECTIONS`). TypeScript signale tout oubli.

## Vérifier avant de terminer

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Tous les paquets `remotion` / `@remotion/*` doivent rester à la **même version exacte**.
