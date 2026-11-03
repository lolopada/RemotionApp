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

| Besoin                  | Choix                                            | Pourquoi                                            |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Moteur vidéo            | **Remotion** (Player + `@remotion/web-renderer`) | une composition React pour l'aperçu et l'export     |
| Export                  | rendu **dans le navigateur** (WebCodecs)         | zéro charge serveur, pas de GPU nécessaire          |
| Transitions             | `@remotion/transitions`                          | fondu, glissement, volet, compatibles avec l'export |
| Interface               | React 19 + Vite 8 + Tailwind 4                   | rapide, léger, standard                             |
| État + annuler/rétablir | Zustand + Immer + Zundo                          | simple, mutations lisibles, historique gratuit      |
| Format des projets      | **Zod** (`packages/schema`)                      | même validation côté éditeur et côté serveur        |
| Serveur                 | **Hono** sur Node                                | quelques Mo de RAM, API + fichiers statiques        |
| Comptes + données       | **SQLite intégré à Node** (`node:sqlite`)        | aucune dépendance, un seul fichier à sauvegarder    |
| Mots de passe           | scrypt (`node:crypto`) + cookie de session       | standard, rien à installer                          |
| Qualité                 | TypeScript strict, Biome, Vitest                 | un seul outil pour lint + format, très rapide       |

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
      routes/        /api/auth, /api/projects, /api/assets, /api/videos
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

Chaque calque a `transform` (position, taille, rotation, opacité) et `animation`
(entrée, sortie, zoom lent).

### Ajouter un type de calque (ex. vidéo, sticker animé)

1. `packages/schema/src/layers.ts` : son schéma, ajouté à `LayerSchema`.
2. `packages/composition/src/layers/` : son composant de rendu, ajouté au `registry`.
3. `apps/editor/src/features/inspector/sections/` : son panneau de réglages.

TypeScript refuse de compiler tant qu'une de ces trois étapes manque.

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
- Si deux onglets modifient le même projet, le dernier enregistré l'emporte.

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

**Polices.** Elles viennent de Google Fonts via `@remotion/google-fonts`. Pour
tout héberger toi-même, passe à `@remotion/fonts` avec des fichiers locaux.

**Licence Remotion.** Gratuite pour un particulier ou une structure de 3
personnes maximum, y compris en usage commercial. Au-delà, licence entreprise.
Le rendu navigateur envoie un événement de télémétrie par export (domaine, IP,
réussite ; aucun contenu). Voir <https://www.remotion.dev/docs/license>.

## Prochaines étapes

- [ ] Poignées de redimensionnement/rotation sur l'aperçu (`react-moveable`)
- [ ] Recadrage au double-clic sur une photo
- [ ] Historique des versions d'un projet (restaurer une version d'hier)
- [ ] Quota de stockage par compte
- [ ] Forme d'onde et découpe audio dans la piste (`wavesurfer.js`)
- [ ] Détourage IA : `rembg` sur le serveur (CPU) ou `transformers.js` dans le navigateur
- [ ] Calques vidéo (`<Video>` de `@remotion/media`)
- [ ] Export de secours côté serveur pour les navigateurs sans WebCodecs
