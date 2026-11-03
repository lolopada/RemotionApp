# Déploiement sur ton serveur

Le serveur de prod sert l'éditeur et l'API sur un seul port. Il ne fait aucun
rendu vidéo : quelques dizaines de Mo de RAM suffisent. Il faut Node 22.13 ou
plus (pour la base SQLite intégrée `node:sqlite`).

## 1. Build et lancement

```bash
pnpm install --frozen-lockfile
pnpm build                      # → apps/editor/dist
PORT=3001 DATA_DIR=/srv/montage/data pnpm start
```

Variables d'environnement (voir `.env.example`) :

| Variable        | Défaut             | Rôle                                |
| --------------- | ------------------ | ----------------------------------- |
| `PORT`          | `3001`             | port HTTP                           |
| `HOST`          | `0.0.0.0`          | interface d'écoute                  |
| `DATA_DIR`      | `./data`           | base + fichiers (**à sauvegarder**) |
| `MAX_UPLOAD_MB` | `200`              | taille max d'une photo / musique    |
| `MAX_EXPORT_MB` | `2048`             | taille max d'une vidéo exportée     |
| `ALLOW_SIGNUP`  | `true`             | `false` = plus de nouveaux comptes  |
| `SESSION_DAYS`  | `60`               | durée de connexion sans activité    |
| `EDITOR_DIST`   | `apps/editor/dist` | build de l'éditeur à servir         |

## 2. HTTPS (obligatoire pour l'export)

WebCodecs, qui encode la vidéo dans le navigateur, n'existe qu'en contexte
sécurisé (HTTPS ou localhost). Exemple avec Caddy, qui gère le certificat seul :

```caddyfile
montage.mondomaine.fr {
    encode zstd gzip
    request_body max_size 2GB   # vidéos exportées
    reverse_proxy 127.0.0.1:3001
}
```

Sur un réseau local sans domaine : Caddy avec `tls internal`, ou un tunnel
(Tailscale, Cloudflare Tunnel).

## 3. Service systemd

```ini
# /etc/systemd/system/montage.service
[Unit]
Description=Montage (éditeur vidéo)
After=network.target

[Service]
WorkingDirectory=/srv/montage/app
Environment=NODE_ENV=production PORT=3001 DATA_DIR=/srv/montage/data
ExecStart=/usr/bin/env pnpm start
Restart=on-failure
User=montage

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now montage
```

## Sauvegarde

Tout l'état est dans `DATA_DIR` : `montage.db` (comptes, projets, index des
fichiers) et `files/` (photos, musiques, vidéos). Pour une copie cohérente de la
base pendant que le serveur tourne :

```bash
sqlite3 /srv/montage/data/montage.db ".backup /srv/backup/montage.db"
rsync -a /srv/montage/data/files/ /srv/backup/files/
```

(ou arrêter le service, puis copier le dossier entier).

## Mot de passe oublié

Pas d'e-mail, donc pas de lien de réinitialisation. Pour remettre un mot de
passe à zéro, le plus simple est de créer un compte temporaire avec le nouveau
mot de passe, puis de copier son empreinte :

```bash
sqlite3 data/montage.db "UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE username = 'temporaire') WHERE username = 'mon_compte'; DELETE FROM users WHERE username = 'temporaire';"
```
