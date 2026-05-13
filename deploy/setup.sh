#!/usr/bin/env bash
# Grant CRM — skrypt deployu na Azure VM (Ubuntu 22.04/24.04)
# Uruchom jako root: sudo bash setup.sh
set -euo pipefail

DOMAIN="grantscrm.inis.it"
APP_DIR="/opt/grantcrm"
ADMIN_EMAIL="dariusz.wit@mnaw.org.pl"

echo "========================================"
echo " Grant CRM — Azure VM Setup"
echo " Domena: $DOMAIN"
echo "========================================"

# --- 1. Docker ---
if ! command -v docker &>/dev/null; then
  echo "[1/5] Instalacja Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
echo "[1/5] Docker OK ($(docker --version | cut -d' ' -f3 | tr -d ','))"

# --- 2. Katalog aplikacji ---
echo "[2/5] Przygotowanie katalogu $APP_DIR..."
mkdir -p "$APP_DIR"

if [ ! -f "$APP_DIR/package.json" ]; then
  echo
  echo "UWAGA: Skopiuj pliki z katalogu grantmakers/ do $APP_DIR"
  echo "  Z lokalnej maszyny:"
  echo "    scp -r ./grantmakers/* user@<vm-ip>:$APP_DIR/"
  echo "  lub git clone repozytorium i skopiuj."
  echo
  read -rp "Naciśnij ENTER gdy pliki są gotowe w $APP_DIR... "
fi
echo "[2/5] Pliki OK"

# --- 3. .env ---
if [ ! -f "$APP_DIR/.env" ]; then
  echo "[3/5] Generowanie .env z losowymi sekretami..."
  DB_PASS=$(openssl rand -base64 32 | tr -d '+=/\n' | head -c 32)
  SESSION_SEC=$(openssl rand -base64 48 | tr -d '+=/\n')
  ADMIN_PASS=$(openssl rand -base64 12 | tr -d '+=/\n')
  cat > "$APP_DIR/.env" <<ENVEOF
DB_PASSWORD=${DB_PASS}
SESSION_SECRET=${SESSION_SEC}
ADMIN_PASSWORD=${ADMIN_PASS}
AI_PROVIDER=fallback
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
ENVEOF
  echo
  echo ">>> ZANOTUJ HASŁO ADMINA: ${ADMIN_PASS} <<<"
  echo "    (login: admin)"
  echo
else
  echo "[3/5] .env już istnieje — pomijam generowanie"
fi

# --- 4. SSL (Let's Encrypt) ---
echo "[4/5] Pobieranie certyfikatu SSL dla $DOMAIN..."
echo "      (port 80 musi być wolny — upewnij się, że nginx/apache nie jest uruchomiony)"
mkdir -p /var/www/certbot /etc/letsencrypt

docker run --rm \
  -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  --email "$ADMIN_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo "[4/5] Certyfikat SSL OK"

# --- 5. Uruchomienie ---
echo "[5/5] Uruchamianie kontenerów..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d

echo
echo "========================================"
echo " Aplikacja uruchomiona!"
echo " Adres: https://$DOMAIN"
echo "========================================"
echo

# --- Cron: automatyczne odnowienie SSL ---
CRON_LINE="0 0,12 * * * docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /var/www/certbot:/var/www/certbot certbot/certbot renew --quiet 2>/dev/null && docker exec grantcrm_nginx nginx -s reload 2>/dev/null || true"
if ! (crontab -l 2>/dev/null | grep -qF "certbot renew"); then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "Cron odnowienia SSL skonfigurowany (co 12h)."
fi

echo "Status kontenerów:"
docker compose -f "$APP_DIR/docker-compose.prod.yml" ps
