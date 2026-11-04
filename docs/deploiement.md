# Déploiement sur ton serveur

## Installation rapide (conteneur Debian/Ubuntu, derrière Nginx Proxy Manager)

Dans la CT, **en root** (dépôt : <https://github.com/lolopada/RemotionApp.git>) :

```bash
apt update && apt install -y git
git clone https://github.com/lolopada/RemotionApp.git /root/montage-src
cd /root/montage-src
./deploy/install.sh --domain montage.paada.fr
```

Si le dépôt est privé, ajoute une clé de déploiement (Settings → Deploy keys) et clone avec
`git@github.com:lolopada/RemotionApp.git`, ou utilise un jeton d'accès personnel avec l'URL HTTPS.

Le script installe Node ≥ 22.13 et pnpm si besoin, crée l'utilisateur `montage`, construit l'éditeur,
écrit `/etc/montage.env`, installe le service systemd et la sauvegarde quotidienne (03h30, 14 jours
gardés), puis vérifie que l'API répond. **Pour mettre à jour : `cd /root/montage-src && ./deploy/install.sh --pull`**
(`git pull` puis réinstallation ; sauvegarde automatique avant, configuration et données conservées).
Options : `--pull`, `--source DIR`, `--port N`, `--data-dir DIR`, `--closed` (inscriptions fermées dès le départ).

Réglages de Nginx Proxy Manager (Proxy Host → SSL : Let's Encrypt, Force SSL, HTTP/2 ; onglet _Advanced_) :

```nginx
client_max_body_size 2g;
proxy_request_buffering off;
proxy_buffering off;
proxy_read_timeout 900s;
proxy_send_timeout 900s;
send_timeout 900s;
```

### Quelle version tourne ?

Chaque build porte un numéro : **version** (champ `version` du `package.json` racine, à augmenter
quand tu veux marquer une étape) + **commit git** (+ `+modifs` si des fichiers ont changé sans
commit) + **date du build**. On le voit :

- **sur le site**, en bas de « Mes projets » et de l'écran de connexion (ex. `v1.0.0 · a1b2c3d · 04/11/2026 19:30`) ;
- **par l'API** : `curl https://montage.paada.fr/api/health` ;
- **dans la CT** : `./deploy/install.sh --version` (code du dépôt vs version en ligne) et `montage-doctor`,
  qui dit aussi s'il y a des commits sur GitHub pas encore installés ;
- **pendant une mise à jour** : `install.sh` affiche l'ancienne et la nouvelle version, puis vérifie que
  le serveur annonce bien le nouveau commit (sinon il s'arrête en erreur).

Si une mise à jour est installée pendant qu'un onglet est ouvert, le site affiche « Nouvelle version »
(bandeau sur l'accueil, bouton dans l'éditeur qui enregistre puis recharge). La page n'est jamais
gardée en cache par le navigateur (seuls les fichiers de `/assets`, dont le nom change à chaque build, le sont).

### Vérifier que tout marche

| Outil                                                                            | Où                       | Rôle                                                                      |
| -------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `montage-doctor`                                                                 | dans la CT               | service, port, Node, base SQLite, disque, sauvegardes, erreurs du journal |
| `node deploy/smoke-test.mjs https://montage.paada.fr --user test --password '…'` | n'importe où (Node ≥ 22) | test complet de bout en bout à travers NPM                                |

Le test complet couvre : certificat et redirection HTTPS, éditeur et type MIME du JavaScript, refus sans
connexion, protection CSRF, cookie `Secure`, projets/versions/modèles, photos et musiques, fichiers privés
(accès refusé aux autres comptes, requêtes `Range`), envoi d'un gros MP4 avec empreinte SHA-256, limite
des essais de connexion. Options : `--big-mb 300` (vérifie `client_max_body_size` et les délais de NPM),
`--browser` (ajoute un **vrai export vidéo** dans Chromium : `mkdir ~/e2e && cd ~/e2e && npm i playwright
&& npx playwright install chromium --with-deps`, puis lance le test depuis ce dossier),
`--user2/--password2` (test d'isolation entre deux comptes quand les inscriptions sont fermées),
`--no-ratelimit`. Code de sortie 1 s'il y a un échec. Utilise un compte dédié (`--user`) : sans lui, un compte
`smoke-xxxx` est créé et reste en base.

Les sections suivantes détaillent la même installation, à la main.

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

| Variable                   | Défaut             | Rôle                                |
| -------------------------- | ------------------ | ----------------------------------- |
| `PORT`                     | `3001`             | port HTTP                           |
| `HOST`                     | `0.0.0.0`          | interface d'écoute                  |
| `DATA_DIR`                 | `./data`           | base + fichiers (**à sauvegarder**) |
| `MAX_UPLOAD_MB`            | `200`              | taille max d'une photo / musique    |
| `MAX_EXPORT_MB`            | `2048`             | taille max d'une vidéo exportée     |
| `ALLOW_SIGNUP`             | `true`             | `false` = plus de nouveaux comptes  |
| `SESSION_DAYS`             | `60`               | durée de connexion sans activité    |
| `VERSION_INTERVAL_MINUTES` | `10`               | écart min. entre deux versions auto |
| `MAX_AUTO_VERSIONS`        | `50`               | versions auto gardées par projet    |
| `EDITOR_DIST`              | `apps/editor/dist` | build de l'éditeur à servir         |

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
