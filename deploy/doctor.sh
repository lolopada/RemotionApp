#!/usr/bin/env bash
# Contrôle de santé local de Montage (à lancer dans la CT) : montage-doctor
set -uo pipefail
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else G=""; Y=""; R=""; N=""; fi
fail=0
ok()   { echo "  ${G}✓${N} $*"; }
warn() { echo "  ${Y}!${N} $*"; }
bad()  { echo "  ${R}✗${N} $*"; fail=1; }

ENV_FILE="${ENV_FILE:-/etc/montage.env}"
[[ -f "$ENV_FILE" ]] || { bad "$ENV_FILE introuvable"; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
PORT="${PORT:-3001}"; DATA_DIR="${DATA_DIR:-/srv/montage/data}"

echo "Service"
systemctl is-active --quiet montage && ok "montage actif ($(systemctl show -p ActiveEnterTimestamp --value montage))" || bad "service montage arrêté (journalctl -u montage -n 50)"
systemctl is-enabled --quiet montage && ok "démarre au boot" || warn "ne démarre pas au boot (systemctl enable montage)"
restarts="$(systemctl show -p NRestarts --value montage 2>/dev/null || echo 0)"
[[ "${restarts:-0}" -gt 3 ]] && warn "$restarts redémarrages depuis le lancement" || ok "stable ($restarts redémarrage(s))"

echo "Réponse HTTP"
curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" | grep -q '"ok":true' && ok "API (port $PORT)" || bad "l'API ne répond pas sur le port $PORT"
curl -fsS -m 5 "http://127.0.0.1:$PORT/" | grep -qi 'id="root"' && ok "éditeur servi" || bad "l'éditeur n'est pas servi (build manquant ?)"

echo "Node"
v="$(node -p 'process.versions.node' 2>/dev/null || echo 0)"
[[ "$(printf '%s\n22.13.0\n' "$v" | sort -V | head -n1)" == "22.13.0" ]] && ok "Node $v" || bad "Node $v < 22.13.0"

echo "Données ($DATA_DIR)"
if [[ -f "$DATA_DIR/montage.db" ]]; then
  res="$(sqlite3 "$DATA_DIR/montage.db" 'PRAGMA integrity_check;' 2>&1 | head -n1)"
  [[ "$res" == "ok" ]] && ok "base SQLite intacte" || bad "base abîmée : $res"
  echo "    $(sqlite3 "$DATA_DIR/montage.db" "SELECT count(*)||' compte(s), '||(SELECT count(*) FROM projects)||' projet(s), '||(SELECT count(*) FROM files)||' fichier(s)' FROM users;" 2>/dev/null)"
else
  bad "montage.db absente"
fi
use="$(df -P "$DATA_DIR" | awk 'NR==2{gsub("%","",$5);print $5}')"
free="$(df -Ph "$DATA_DIR" | awk 'NR==2{print $4}')"
if [[ "${use:-0}" -ge 90 ]]; then bad "disque plein à ${use}% ($free libres)"; elif [[ "${use:-0}" -ge 80 ]]; then warn "disque à ${use}% ($free libres)"; else ok "disque à ${use}% ($free libres)"; fi
[[ "$(stat -c %U "$DATA_DIR")" == "montage" ]] && ok "propriétaire des données : montage" || warn "les données n'appartiennent pas à l'utilisateur montage"

echo "Sauvegardes"
last="$(find /srv/montage/backups -maxdepth 1 -mindepth 1 -type d -name '2*' 2>/dev/null | sort | tail -n1)"
if [[ -z "$last" ]]; then warn "aucune sauvegarde (montage-backup)"; else
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 3600 ))
  [[ $age -le 48 ]] && ok "dernière : $(basename "$last") (il y a ${age} h)" || warn "dernière sauvegarde il y a ${age} h"
fi
systemctl is-active --quiet montage-backup.timer && ok "sauvegarde quotidienne planifiée" || warn "timer de sauvegarde inactif"

echo "Configuration"
[[ "${ALLOW_SIGNUP:-true}" == "false" ]] && ok "inscriptions fermées" || warn "ALLOW_SIGNUP=true : n'importe qui peut créer un compte"
echo "  MAX_UPLOAD_MB=${MAX_UPLOAD_MB:-200}  MAX_EXPORT_MB=${MAX_EXPORT_MB:-2048}  SESSION_DAYS=${SESSION_DAYS:-60}"

echo "Journal (dernière heure)"
errs="$(journalctl -u montage --since '1 hour ago' --no-pager -p err 2>/dev/null | grep -vc -- '^-- ' || true)"
[[ "${errs:-0}" -gt 0 ]] && warn "$errs ligne(s) d'erreur (journalctl -u montage -p err --since '1 hour ago')" || ok "aucune erreur"

echo
[[ $fail -eq 0 ]] && echo "${G}Tout est en ordre.${N}" || echo "${R}Des problèmes sont à corriger.${N}"
exit $fail
