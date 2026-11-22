#!/usr/bin/env bash
# Installation / mise à jour de Montage dans un conteneur Debian ou Ubuntu (à lancer en root).
#
#   Première installation :   ./deploy/install.sh --domain montage.paada.fr
#   Mise à jour depuis GitHub : ./deploy/install.sh --pull
#   (équivaut à git pull puis relance ; sans --pull, installe le code tel qu'il est sur le disque)
#
# Le script est relançable sans risque : il garde la configuration (/etc/montage.env) et les
# données, fait une sauvegarde avant chaque mise à jour, puis relance le service.
set -Eeuo pipefail

# ---------- Réglages (modifiables par options) ----------
APP_USER="montage"
BASE_DIR="/srv/montage"
APP_DIR="$BASE_DIR/app"
DATA_DIR="$BASE_DIR/data"
BACKUP_DIR="$BASE_DIR/backups"
ENV_FILE="/etc/montage.env"
PORT="3001"
DOMAIN=""
CLOSED="no"          # yes = ALLOW_SIGNUP=false dès l'installation
JAMENDO=""           # clé « client_id » Jamendo (propositions de musique)
BACKUP_TIMER="yes"
SOURCE=""
PULL="no"
SHOW_VERSION="no"
REPO_URL="https://github.com/lolopada/RemotionApp.git"
NODE_MAJOR="22"
NODE_MIN="22.13.0"

usage() {
  cat <<USAGE
Usage : $0 [options]
  --source DIR      dossier du code à installer (défaut : le dépôt qui contient ce script)
  --version         affiche la version du code et celle en ligne, puis s'arrête
  --pull            fait un git pull (fast-forward) du dépôt avant d'installer
  --repo URL        dépôt cité dans les messages d'aide (défaut : $REPO_URL)
  --domain NOM      nom de domaine public (affichage des consignes NPM uniquement)
  --port N          port d'écoute (défaut : $PORT)
  --data-dir DIR    base + fichiers des comptes (défaut : $DATA_DIR)
  --closed          ferme les inscriptions (ALLOW_SIGNUP=false)
  --jamendo CLÉ     active les propositions de musique (client_id Jamendo, gratuit :
                    https://devportal.jamendo.com) ; enregistrée dans /etc/montage.env
  --no-backup-timer n'installe pas la sauvegarde quotidienne
  -h, --help        cette aide
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --pull) PULL="yes"; shift ;;
    --version) SHOW_VERSION="yes"; shift ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --data-dir) DATA_DIR="$2"; shift 2 ;;
    --closed) CLOSED="yes"; shift ;;
    --jamendo) JAMENDO="$2"; shift 2 ;;
    --no-backup-timer) BACKUP_TIMER="no"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; usage; exit 2 ;;
  esac
done

# ---------- Affichage ----------
if [[ -t 1 ]]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=""; G=""; Y=""; R=""; N=""; fi
step() { echo; echo "${B}==> $*${N}"; }
ok()   { echo "  ${G}✓${N} $*"; }
warn() { echo "  ${Y}!${N} $*"; }
die()  { echo "  ${R}✗ $*${N}" >&2; exit 1; }
trap 'die "Échec à la ligne $LINENO. Corrige le problème puis relance le script (il est relançable)."' ERR

[[ $EUID -eq 0 ]] || die "À lancer en root (sudo $0)."
command -v apt-get >/dev/null || die "Ce script supporte Debian et Ubuntu (apt)."

# Dossier du code : le dépôt qui contient deploy/install.sh, sauf indication contraire.
if [[ -z "$SOURCE" ]]; then SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; fi
if [[ "$PULL" == yes ]]; then
  command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git >/dev/null; }
  if [[ -d "$SOURCE/.git" ]]; then
    step "Récupération de la dernière version (git pull)"
    git -C "$SOURCE" pull --ff-only || die "git pull impossible (modifications locales ou branches divergentes ?). Voir : git -C $SOURCE status"
    ok "code à jour : $(git -C "$SOURCE" log -1 --format='%h %s')"
  else
    die "$SOURCE n'est pas un clone git. Fais : git clone $REPO_URL <dossier> puis lance le script depuis ce dossier."
  fi
fi
[[ -f "$SOURCE/package.json" && -d "$SOURCE/apps/server" ]] || die "$SOURCE ne ressemble pas au dépôt Montage (package.json / apps/server introuvables)."
SOURCE="$(cd "$SOURCE" && pwd)"

# ---------- Numéro de version ----------
# Version = champ "version" du package.json + commit git (« +modifs » si des fichiers ont changé
# sans commit). Elle est inscrite dans le build et renvoyée par /api/health.
json_field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" | head -n1; }
NEW_VERSION="$(sed -n 's/^  "version": "\(.*\)",*$/\1/p' "$SOURCE/package.json" | head -n1)"
NEW_VERSION="${NEW_VERSION:-0.0.0}"
NEW_COMMIT="inconnu"
if command -v git >/dev/null && [[ -d "$SOURCE/.git" ]]; then
  NEW_COMMIT="$(git -C "$SOURCE" rev-parse --short HEAD 2>/dev/null || echo inconnu)"
  [[ -n "$(git -C "$SOURCE" status --porcelain 2>/dev/null)" ]] && NEW_COMMIT="$NEW_COMMIT+modifs"
fi
live_port() {
  local p=""
  [[ -f "$ENV_FILE" ]] && p="$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2)"
  echo "${p:-$PORT}"
}
live_health() { curl -fsS -m 3 "http://127.0.0.1:$(live_port)/api/health" 2>/dev/null || true; }
format_version() { # version commit date
  local d=""
  [[ -n "${3:-}" ]] && d=" · construite le $(date -d "$3" '+%d/%m/%Y %H:%M' 2>/dev/null || echo "$3")"
  echo "v$1 · $2$d"
}
LIVE="$(live_health)"
LIVE_VERSION="$(echo "$LIVE" | json_field version)"
LIVE_COMMIT="$(echo "$LIVE" | json_field commit)"
LIVE_TXT="aucune (service arrêté ou pas encore installé)"
[[ -n "$LIVE_VERSION" ]] && LIVE_TXT="$(format_version "$LIVE_VERSION" "$LIVE_COMMIT" "$(echo "$LIVE" | json_field builtAt)")"
if [[ "$SHOW_VERSION" == "yes" ]]; then
  echo "Code ($SOURCE) : v$NEW_VERSION · $NEW_COMMIT"
  echo "En ligne        : $LIVE_TXT"
  if [[ -n "$LIVE_COMMIT" && "$LIVE_COMMIT" != "$NEW_COMMIT" ]]; then echo "→ différent : lance $0 pour installer le code."; fi
  exit 0
fi

version_ge() { [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]; }

UPDATE="no"
[[ -f "/etc/systemd/system/montage.service" ]] && UPDATE="yes"
step "Montage — $([[ $UPDATE == yes ]] && echo 'mise à jour' || echo 'première installation')"
echo "  code      : $SOURCE"
echo "  version   : ${B}v$NEW_VERSION · $NEW_COMMIT${N}   (en ligne : $LIVE_TXT)"
[[ -n "$LIVE_COMMIT" && "$LIVE_COMMIT" == "$NEW_COMMIT" ]] && warn "cette version est déjà en ligne : réinstallation (rien de neuf depuis GitHub ? essaie --pull)"
echo "  appli     : $APP_DIR"
echo "  données   : $DATA_DIR"
echo "  port      : $PORT"

# ---------- 1. Paquets système ----------
step "1/8  Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git rsync sqlite3 xz-utils >/dev/null
ok "curl, rsync, sqlite3"

# ---------- 2. Node.js ----------
step "2/8  Node.js ≥ $NODE_MIN"
current_node=""
if command -v node >/dev/null; then current_node="$(node -p 'process.versions.node')"; fi
if [[ -n "$current_node" ]] && version_ge "$current_node" "$NODE_MIN"; then
  ok "Node $current_node déjà installé"
else
  [[ -n "$current_node" ]] && warn "Node $current_node trop ancien : installation de Node $NODE_MAJOR (NodeSource)"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
  current_node="$(node -p 'process.versions.node')"
  version_ge "$current_node" "$NODE_MIN" || die "Node $current_node installé, mais $NODE_MIN ou plus est requis."
  ok "Node $current_node installé"
fi
NODE_BIN="$(command -v node)"

# ---------- 3. pnpm ----------
step "3/8  pnpm"
PNPM_VERSION="$(node -p "(require('$SOURCE/package.json').packageManager||'').split('@')[1]||''")"
[[ -n "$PNPM_VERSION" ]] || die "packageManager introuvable dans package.json."
if command -v pnpm >/dev/null && [[ "$(pnpm --version 2>/dev/null || true)" == "$PNPM_VERSION" ]]; then
  ok "pnpm $PNPM_VERSION déjà installé"
else
  npm install -g "pnpm@$PNPM_VERSION" >/dev/null 2>&1 || die "Impossible d'installer pnpm@$PNPM_VERSION (réseau ?)."
  ok "pnpm $(pnpm --version) installé"
fi
PNPM_BIN="$(command -v pnpm)"

# ---------- 4. Utilisateur et dossiers ----------
step "4/8  Utilisateur et dossiers"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$BASE_DIR" --shell /usr/sbin/nologin "$APP_USER"
  ok "utilisateur système « $APP_USER » créé"
else
  ok "utilisateur « $APP_USER » existe"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$BASE_DIR" "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"
ok "dossiers prêts"

# ---------- 5. Sauvegarde avant mise à jour ----------
step "5/8  Sauvegarde avant mise à jour"
if [[ "$UPDATE" == "yes" && -f "$DATA_DIR/montage.db" ]]; then
  if [[ -x /usr/local/bin/montage-backup ]]; then
    /usr/local/bin/montage-backup && ok "sauvegarde faite dans $BACKUP_DIR"
  else
    warn "script de sauvegarde absent, étape ignorée"
  fi
else
  ok "rien à sauvegarder (première installation)"
fi

# ---------- 6. Code, dépendances, build ----------
step "6/8  Code, dépendances et build"
systemctl stop montage 2>/dev/null || true
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude data --exclude '*.log' \
  --exclude '.vite' --exclude coverage \
  "$SOURCE/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "code copié"

run_as_app() {
  runuser -u "$APP_USER" -- env HOME="$BASE_DIR" PATH="$(dirname "$NODE_BIN"):$(dirname "$PNPM_BIN"):/usr/local/bin:/usr/bin:/bin" \
    CI=true NODE_ENV=development bash -c "cd '$APP_DIR' && $*"
}
echo "  installation des dépendances (quelques minutes la première fois)…"
run_as_app "pnpm install --frozen-lockfile" >/tmp/montage-install.log 2>&1 || { tail -n 30 /tmp/montage-install.log; die "pnpm install a échoué (journal : /tmp/montage-install.log)."; }
ok "dépendances installées"
run_as_app "MONTAGE_COMMIT='$NEW_COMMIT' pnpm build" >/tmp/montage-build.log 2>&1 || { tail -n 30 /tmp/montage-build.log; die "pnpm build a échoué (journal : /tmp/montage-build.log)."; }
[[ -f "$APP_DIR/apps/editor/dist/index.html" ]] || die "Le build n'a pas produit apps/editor/dist/index.html."
ok "éditeur compilé (v$NEW_VERSION · $NEW_COMMIT)"
echo "$SOURCE" > "$BASE_DIR/source-path"

# ---------- 7. Configuration, service, sauvegarde ----------
step "7/8  Configuration et service systemd"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
# Configuration de Montage (lue par le service systemd). Après modification :
#   systemctl restart montage
NODE_ENV=production
PORT=$PORT
HOST=0.0.0.0
DATA_DIR=$DATA_DIR
MAX_UPLOAD_MB=200
MAX_EXPORT_MB=2048
# true tant que tu n'as pas créé ton compte ; passe à false ensuite (site public !)
ALLOW_SIGNUP=$([[ $CLOSED == yes ]] && echo false || echo true)
SESSION_DAYS=60
VERSION_INTERVAL_MINUTES=10
MAX_AUTO_VERSIONS=50
# Propositions de musique (onglet Musique) : clé « client_id » Jamendo, gratuite pour un
# usage non commercial, à créer sur https://devportal.jamendo.com. Vide = désactivé.
JAMENDO_CLIENT_ID=
ENV
  chmod 0640 "$ENV_FILE"; chown root:"$APP_USER" "$ENV_FILE"
  ok "$ENV_FILE créé"
else
  ok "$ENV_FILE conservé (tes réglages ne sont pas touchés)"
fi
# Clé Jamendo donnée en option : ajoutée ou remplacée dans la configuration.
if [[ -n "$JAMENDO" ]]; then
  if grep -qE '^#? *JAMENDO_CLIENT_ID=' "$ENV_FILE"; then
    sed -i -E "s|^#? *JAMENDO_CLIENT_ID=.*|JAMENDO_CLIENT_ID=$JAMENDO|" "$ENV_FILE"
  else
    printf '\n# Propositions de musique (https://devportal.jamendo.com)\nJAMENDO_CLIENT_ID=%s\n' "$JAMENDO" >> "$ENV_FILE"
  fi
  ok "propositions de musique Jamendo activées"
fi
# Le port réellement utilisé est celui du fichier de configuration.
PORT="$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2)"; PORT="${PORT:-3001}"
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2)"; DATA_DIR="${DATA_DIR:-$BASE_DIR/data}"

cat > /etc/systemd/system/montage.service <<UNIT
[Unit]
Description=Montage (éditeur vidéo web)
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=HOME=$BASE_DIR
Environment=PATH=$(dirname "$NODE_BIN"):$(dirname "$PNPM_BIN"):/usr/local/bin:/usr/bin:/bin
ExecStart=$PNPM_BIN start
Restart=on-failure
RestartSec=3
# Durcissement
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=$BASE_DIR $DATA_DIR
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

# Script de sauvegarde (copie cohérente de la base + fichiers, 14 jours gardés)
cat > /usr/local/bin/montage-backup <<'BACKUP'
#!/usr/bin/env bash
set -Eeuo pipefail
ENV_FILE="/etc/montage.env"
DATA_DIR="$(grep -E '^DATA_DIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2)"
BACKUP_DIR="${BACKUP_DIR:-/srv/montage/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date +%Y%m%d-%H%M%S)"
dest="$BACKUP_DIR/$stamp"
mkdir -p "$dest"
sqlite3 "$DATA_DIR/montage.db" ".backup '$dest/montage.db'"
# Les fichiers sont immuables (jamais modifiés après envoi) : une copie incrémentale suffit.
mkdir -p "$BACKUP_DIR/files"
rsync -a "$DATA_DIR/files/" "$BACKUP_DIR/files/"
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -name '2*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "Sauvegarde : $dest (base) + $BACKUP_DIR/files"
BACKUP
chmod 0755 /usr/local/bin/montage-backup

if [[ "$BACKUP_TIMER" == "yes" ]]; then
  cat > /etc/systemd/system/montage-backup.service <<'UNIT'
[Unit]
Description=Sauvegarde de Montage

[Service]
Type=oneshot
ExecStart=/usr/local/bin/montage-backup
UNIT
  cat > /etc/systemd/system/montage-backup.timer <<'UNIT'
[Unit]
Description=Sauvegarde quotidienne de Montage

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  ok "sauvegarde quotidienne à 03h30 (14 jours gardés)"
fi

install -m 0755 "$APP_DIR/deploy/doctor.sh" /usr/local/bin/montage-doctor 2>/dev/null && ok "commande montage-doctor installée"

systemctl daemon-reload
systemctl enable montage >/dev/null 2>&1
[[ "$BACKUP_TIMER" == "yes" ]] && systemctl enable --now montage-backup.timer >/dev/null 2>&1
systemctl restart montage
ok "service démarré"

# ---------- 8. Vérification ----------
step "8/8  Vérification"
healthy="no"
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true'; then healthy="yes"; break; fi
  sleep 1
done
if [[ "$healthy" != "yes" ]]; then
  journalctl -u montage -n 40 --no-pager || true
  die "Le serveur ne répond pas sur le port $PORT (voir le journal ci-dessus)."
fi
ok "l'API répond (http://127.0.0.1:$PORT/api/health)"
SERVED="$(curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
SERVED_COMMIT="$(echo "$SERVED" | json_field commit)"
SERVED_TXT="$(format_version "$(echo "$SERVED" | json_field version)" "$SERVED_COMMIT" "$(echo "$SERVED" | json_field builtAt)")"
if [[ "$SERVED_COMMIT" == "$NEW_COMMIT" ]]; then
  ok "version en ligne : $SERVED_TXT"
else
  die "Le serveur annonce « $SERVED_TXT » au lieu de v$NEW_VERSION · $NEW_COMMIT (un ancien processus tourne encore ? systemctl restart montage)."
fi
curl -fsS "http://127.0.0.1:$PORT/" | grep -qi '<div id="root"' && ok "l'éditeur est servi" || warn "la page d'accueil n'a pas l'air de l'éditeur"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

cat <<DONE

${B}Terminé : $SERVED_TXT${N}
  Service : systemctl status montage   ·   Journal : journalctl -u montage -f
  Version : affichée en bas de la page d'accueil du site, et par  $SOURCE/deploy/install.sh --version
  Mise à jour : cd $SOURCE && ./deploy/install.sh --pull

${B}À faire dans Nginx Proxy Manager${N} (Proxy Host ${DOMAIN:-montage.exemple.fr}) :
  Forward : http  ${IP:-IP-de-la-CT}  $PORT      SSL : Let's Encrypt + Force SSL + HTTP/2
  Onglet Advanced :
      client_max_body_size 2g;
      proxy_request_buffering off;
      proxy_buffering off;
      proxy_read_timeout 900s;
      proxy_send_timeout 900s;
      send_timeout 900s;

${B}Ensuite${N} :
  1. Ouvre https://${DOMAIN:-montage.exemple.fr}, crée ton compte.
  2. Ferme les inscriptions :  sed -i 's/^ALLOW_SIGNUP=.*/ALLOW_SIGNUP=false/' $ENV_FILE && systemctl restart montage
  3. Teste tout :  node $APP_DIR/deploy/smoke-test.mjs https://${DOMAIN:-montage.exemple.fr} --user TEST --password '…' --browser
  4. Santé du serveur :  montage-doctor
DONE
if ! grep -qE '^JAMENDO_CLIENT_ID=.+' "$ENV_FILE"; then
  cat <<DONE
  5. Propositions de musique : crée une clé gratuite sur https://devportal.jamendo.com
     (« client_id »), puis :  ./deploy/install.sh --jamendo TA_CLE
DONE
fi
