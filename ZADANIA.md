# ZADANIA — Grant CRM (grantscrm.linis.it)

## Do zrobienia

(brak)

## Zrobione

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
