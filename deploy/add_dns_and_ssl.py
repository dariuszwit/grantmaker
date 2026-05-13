#!/usr/bin/env python3
"""
Krok 2 deployu: dodaj rekord DNS + pobierz SSL cert.
Uruchom PO walidacji tokena OVH.
"""
import os, sys, json, hashlib, time, subprocess, urllib.request, urllib.error
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

AK = os.environ.get("OVH_APPLICATION_KEY", "")
AS = os.environ.get("OVH_APPLICATION_SECRET", "")
CK = os.environ.get("OVH_CONSUMER_KEY", "")
ENDPOINT = "https://eu.api.ovh.com/1.0"
DOMAIN = "linis.it"
SUBDOMAIN = "grantscrm"
VM_IP = "74.248.33.90"


def ovh_req(method, path, body=None):
    url = f"{ENDPOINT}{path}"
    with urllib.request.urlopen(f"{ENDPOINT}/auth/time") as r:
        ts = r.read().decode().strip()
    body_str = json.dumps(body) if body else ""
    sig = "$1$" + hashlib.sha1(f"{AS}+{CK}+{method}+{url}+{body_str}+{ts}".encode()).hexdigest()
    headers = {"X-Ovh-Application": AK, "X-Ovh-Consumer": CK, "X-Ovh-Signature": sig,
               "X-Ovh-Timestamp": ts, "Content-Type": "application/json"}
    data = body_str.encode() if body_str else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "msg": e.read().decode()[:300]}


def add_dns():
    print(f"\n[DNS] Sprawdzam istniejące rekordy dla {SUBDOMAIN}.{DOMAIN}...")
    records = ovh_req("GET", f"/domain/zone/{DOMAIN}/record?fieldType=A&subDomain={SUBDOMAIN}")
    if isinstance(records, list) and records:
        print(f"  Rekord już istnieje: {records}")
        return True
    if isinstance(records, dict) and "error" in records:
        print(f"  BŁĄD OVH: {records}")
        return False

    print(f"[DNS] Dodaję A record: {SUBDOMAIN}.{DOMAIN} → {VM_IP}")
    result = ovh_req("POST", f"/domain/zone/{DOMAIN}/record", {
        "fieldType": "A", "subDomain": SUBDOMAIN, "target": VM_IP, "ttl": 300
    })
    if isinstance(result, dict) and "error" not in result:
        print(f"  ✓ Rekord dodany (id: {result.get('id')})")
        ovh_req("POST", f"/domain/zone/{DOMAIN}/refresh")
        print("  ✓ Strefa odświeżona")
        return True
    else:
        print(f"  ✗ Błąd dodawania rekordu: {result}")
        return False


def get_ssl():
    fqdn = f"{SUBDOMAIN}.{DOMAIN}"
    print(f"\n[SSL] Czekam na propagację DNS ({fqdn} → {VM_IP})...")
    for i in range(18):
        try:
            import socket
            ip = socket.gethostbyname(fqdn)
            if ip == VM_IP:
                print(f"  ✓ DNS propagacja OK ({ip})")
                break
            else:
                print(f"  DNS → {ip} (oczekuję {VM_IP}), czekam...")
        except Exception:
            print(f"  DNS jeszcze nie propaguje ({i+1}/18), czekam 10s...")
        time.sleep(10)
    else:
        print("  ✗ DNS nie propaguje po 3 minutach. Sprawdź ręcznie i uruchom certbot:")
        print(f"    certbot certonly --webroot -w /var/www/html -d {fqdn} --non-interactive --agree-tos --email dariusz.wit@mnaw.org.pl")
        return False

    print(f"[SSL] Uruchamiam certbot dla {fqdn} na vm-fastovh...")
    cmd = [
        "az", "vm", "run-command", "invoke",
        "--resource-group", "RG-FASTOVH",
        "--name", "vm-fastovh",
        "--command-id", "RunShellScript",
        "--scripts",
        f"certbot certonly --webroot -w /var/www/html -d {fqdn} --non-interactive --agree-tos --email dariusz.wit@mnaw.org.pl && "
        f"cat > /etc/nginx/sites-available/grantscrm-linis.conf << 'NGINXEOF'\n"
        f"server {{\n"
        f"    listen 80;\n"
        f"    server_name {fqdn};\n"
        f"    location /.well-known/acme-challenge/ {{ root /var/www/html; }}\n"
        f"    location / {{ return 301 https://\$host\$request_uri; }}\n"
        f"}}\n"
        f"server {{\n"
        f"    listen 443 ssl http2;\n"
        f"    server_name {fqdn};\n"
        f"    ssl_certificate /etc/letsencrypt/live/{fqdn}/fullchain.pem;\n"
        f"    ssl_certificate_key /etc/letsencrypt/live/{fqdn}/privkey.pem;\n"
        f"    include /etc/letsencrypt/options-ssl-nginx.conf;\n"
        f"    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n"
        f"    client_max_body_size 55m;\n"
        f"    location / {{\n"
        f"        proxy_pass http://127.0.0.1:8080;\n"
        f"        proxy_http_version 1.1;\n"
        f"        proxy_set_header Host \$host;\n"
        f"        proxy_set_header X-Real-IP \$remote_addr;\n"
        f"        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n"
        f"        proxy_set_header X-Forwarded-Proto \$scheme;\n"
        f"        proxy_read_timeout 300;\n"
        f"    }}\n"
        f"}}\n"
        f"NGINXEOF\n"
        f"nginx -t && systemctl reload nginx && echo 'NGINX_SSL_OK'"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if "NGINX_SSL_OK" in result.stdout:
        print(f"  ✓ SSL skonfigurowany! Strona: https://{fqdn}")
        return True
    else:
        print(f"  Certbot output: {result.stdout[:500]}{result.stderr[:200]}")
        return False


if __name__ == "__main__":
    print("=" * 50)
    print(f"  Grant CRM — DNS + SSL Setup")
    print(f"  {SUBDOMAIN}.{DOMAIN} → {VM_IP}")
    print("=" * 50)

    if add_dns() and get_ssl():
        print(f"\n✓ Gotowe! Aplikacja: https://{SUBDOMAIN}.{DOMAIN}")
        print(f"  Login: admin")
        print(f"  Hasło: (z /opt/grantcrm/.env na VM)")
    else:
        print("\n✗ Coś poszło nie tak. Sprawdź logi powyżej.")
