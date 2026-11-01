# ZADANIA — Grant CRM (grantscrm.linis.it)

## Do zrobienia

### 3. Wyrównanie projektu na LenGem (zlecone 2026-11-01 w `D:\dev\general`)

Git przez `git bundle` (LenGem nie ma poświadczeń GitHub), poza gitem nic (projekt bez plików ignorowanych).

## Zrobione

### 2. Usunięcie domeny services.linis.it — zrobione 2026-10-21

Polecenie: „services.linis.it. usuń tę domenę".

- **DNS (OVH, linis.it):** usunięte tylko rekordy A `services` (id 5409294852) i A `www.services`
  (id 5443320478), oba → 20.215.66.208; innych rekordów (`_acme-challenge`, `*.services`) nie było.
  Strefa odświeżona. `nslookup -type=A services.linis.it ns107.ovh.net` i to samo dla `www.` →
  Non-existent domain. Rekordy `grantscrm`, `www.grantscrm`, `meetio` nietknięte.
- **nginx na vm-fastovh:** usunięte `/etc/nginx/sites-enabled/services-linis.conf` (link) i
  `/etc/nginx/sites-available/services-linis.conf`; `nginx -t` OK, reload OK; w `/etc/nginx` brak
  odwołań do services.linis.it.
- **Certyfikat LE:** `certbot delete --cert-name services.linis.it`; zostały certy `fastovh.com`,
  `grantscrm.linis.it`, `meetio.linis.it`.
- **Kopia przed usunięciem (na VM):** `/root/services-linis-it-removed-20261020222639.tgz` (vhost,
  link, renewal conf, live + archive certu; chmod 600).
- **Bez zmian:** kontener docker `linis_services_api` (127.0.0.1:5100) dalej działa (Up 33 h),
  VM nie była restartowana. Usunięcie kontenera i `/home/azureuser/linis-services` to osobna
  decyzja właściciela.
- **Sprawdzone na żywo:** https://grantscrm.linis.it → 302 /login (także `www`),
  https://meetio.linis.it 200, https://fastovh.com 200.
- `deploy/add_dns_and_ssl.py` obsługuje tylko `grantscrm`, nie odtworzy rekordów services — bez zmian.

### 1. Naprawa adresów grantscrm.linis.it i services.linis.it — zrobione 2026-10-20

Polecenie: „napraw te adresy: grantscrm.linis.it i services.linis.it".

- **Przyczyna:** VM `vm-fastovh` przeniesiono do subskrypcji MnaW (RG-FASTOVH) i dostała nowe
  publiczne IP `20.215.66.208`. Rekordy A `grantscrm` i `services` w strefie OVH linis.it nadal
  wskazywały stare IP tej samej VM, `74.248.33.90` (już nieistniejące w żadnej dostępnej
  subskrypcji), więc z zewnątrz był timeout. Przez to cert LE `grantscrm.linis.it` się nie odnowił
  (wygasł 2026-10-01), a `services.linis.it` wygasałby 2026-11-07.
- **Stan aplikacji przed zmianą (sprawdzone):** obie działały lokalnie na vm-fastovh od 32 h —
  `grantcrm_app` (docker, `/opt/grantcrm`, 127.0.0.1:8080, Postgres z danymi: 191 grantodawców)
  i `linis_services_api` (docker, `/home/azureuser/linis-services`, 127.0.0.1:5100,
  `/api/v1/health` → 12 usług). Produkcja ma być na vm-fastovh (skrypt
  `deploy/add_dns_and_ssl.py` wdraża właśnie tam).
- **DNS (OVH, linis.it):** A `grantscrm`, `services` 74.248.33.90 → 20.215.66.208; dodane
  A `www.grantscrm`, `www.services` → 20.215.66.208 (TTL 300), strefa odświeżona, sprawdzone na
  ns107.ovh.net. Bez DNSSEC/proxy.
- **nginx na VM:** dopisane aliasy `www.` w `server_name` obu vhostów; kopia przed zmianą
  `/root/nginx-backup-20261020214702.tgz` (nginx + letsencrypt).
- **Certyfikaty LE:** `grantscrm.linis.it` + `www.grantscrm.linis.it` oraz `services.linis.it` +
  `www.services.linis.it`, ważne do 2027-01-18; `certbot renew --dry-run` OK dla wszystkich 4 certów.
- **Sprawdzone na żywo:** https://grantscrm.linis.it → 302 /login, /login 200 (także `www`);
  http → 301 https; https://services.linis.it/api/v1/health 200 (także `www`); `/` services
  zwraca 404 z założenia (sama API). meetio.linis.it i fastovh.com nadal 200. Load ~0.3,
  RAM bez zmian (~1,1 GB z 3,8 GB).
- `deploy/add_dns_and_ssl.py`: `VM_IP` poprawione na 20.215.66.208.
