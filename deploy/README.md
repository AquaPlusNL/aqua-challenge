# Publieke VM (Ubuntu met systemd)

Deze opzet gebruikt één Node-proces op `127.0.0.1:3000`, Caddy voor HTTPS en
een afzonderlijke SQLite-back-up. Kopieer **nooit** de lokale `.env` of `data/`
naar de VM: die kunnen echte persoonsgegevens en bestaande secrets bevatten.
Voor een eenmalige campagne is Coolify op deze VM niet nodig.

## Voorwaarden

- Een VM met Ubuntu, SSH-toegang en een domein waarvan DNS naar de VM wijst.
- Controleer in Azure de **effectieve NSG-regels** op de netwerkkaart. Een NSG op
  zowel subnet als netwerkkaart moet het verkeer toestaan. Op deze VM: SSH
  alleen vanaf beheeradressen, 80/443 voor bezoekers en geen publieke 3000.
- Node.js 24 of nieuwer op `/usr/bin/node` (`/usr/bin/node --version`); pas de
  twee units aan als het pad anders is. Installeer Caddy volgens de
  [officiële handleiding](https://caddyserver.com/docs/install).
- Open bij de provider en op de VM alleen TCP 80/443 en SSH vanaf beheerde
  adressen. Houd een tweede SSH-sessie open als je `ufw` activeert.
- Een echte `VACATURE_URL`, akkoord op de gepubliceerde privacyverklaring en
  een besluit over hoe recruitment de leads uit de database haalt.

## Installatie

1. Maak een servicegebruiker en mappen:

   ```sh
   sudo useradd --system --home /opt/aqua-challenge --shell /usr/sbin/nologin aqua-challenge
   sudo install -d -o root -g root -m 0755 /opt/aqua-challenge
   sudo install -d -o aqua-challenge -g aqua-challenge -m 0700 /var/lib/aqua-challenge /var/backups/aqua-challenge
   ```

2. Zet alleen de **gecontroleerde broncode** in `/opt/aqua-challenge` (bijvoorbeeld
   met een read-only deploy key en `git clone`). Laat de directory van `root`
   blijven. Installeer afhankelijkheden met `npm ci --omit=dev`; voer dit uit
   voordat de service start. Gebruik geen lokale `.env` of database. Voer
   `npm test` uit voor het starten.

3. Maak `/etc/aqua-challenge.env` met rechten `root:root`, modus `0600`.
   Genereer `IP_SALT` en `ADMIN_TOKEN` afzonderlijk met `openssl rand -hex 32`.
   De inhoud moet minimaal deze regels hebben:

   ```dotenv
   IP_SALT=<64 willekeurige hextekens>
   ADMIN_TOKEN=<andere 64 willekeurige hextekens>
   VACATURE_URL=https://voorbeeld.nl/vacatures/elektrotechniek
   HOST=127.0.0.1
   PORT=3000
   TRUST_PROXY=1
   DB_PATH=/var/lib/aqua-challenge/challenge.db
   LIVE_RELOAD=0
   NODE_ENV=production
   ```

   Controleer dat de waarden voor `HOST`, `PORT`, `TRUST_PROXY` en `DB_PATH`
   overeenkomen met de units. `EnvironmentFile` kan de waarden in een unit
   overschrijven. Voeg alleen de overige gewenste waarden uit `.env.example`
   toe. Gebruik geen tijdelijke vacature-URL voor livegang.

4. Kopieer `deploy/aqua-challenge*.service` en `deploy/aqua-challenge-backup.timer`
   naar `/etc/systemd/system/`. Zet in `deploy/Caddyfile.example` de echte
   domeinnaam en installeer hem als `/etc/caddy/Caddyfile`.

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now aqua-challenge.service
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   sudo systemctl enable --now aqua-challenge-backup.timer
   sudo systemctl start aqua-challenge-backup.service
   ```

5. Stel de firewall pas in nadat SSH-toegang is bevestigd. Laat poort 3000
   gesloten. Beperk SSH zo mogelijk tot beheerde IP-adressen.

   ```sh
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   sudo ufw status verbose
   ```

## Controle na livegang

```sh
systemctl status aqua-challenge.service caddy aqua-challenge-backup.timer
curl -fsS https://<domein>/api/gezond
curl -sS -o /dev/null -w '%{http_code}\n' https://<domein>/api/admin/statistiek
ss -ltn
journalctl -u aqua-challenge.service -n 50 --no-pager
```

De admin-URL moet publiek `404` geven. De app moet alleen op `127.0.0.1:3000`
luisteren. Controleer ook dat een verzonnen `X-Forwarded-For`-header niet het
client-IP voor limieten kan bepalen. Beheer de admin-API via een SSH-tunnel of
direct op de VM met het token uit het afgeschermde omgevingsbestand.

De dagelijkse back-up gebruikt SQLite's online-back-upfunctie en controleert
de kopie. Controleer een herstel op een aparte testomgeving. Kopieer de
back-ups **versleuteld** naar een andere locatie en stel daar een bewaartermijn
in; bestanden op dezelfde VM helpen niet bij VM-verlies. Beperk toegang, want
de back-ups bevatten telefoonnummers en e-mailadressen.

Plan updates voor Ubuntu, Node, Caddy en de npm-afhankelijkheden. Controleer
de service en het certificaat na elke update. Zet testinzendingen niet mee live.

## Leads ophalen en campagne afsluiten

De app verwijdert leads zonder talentpooltoestemming na 28 dagen; met aparte
talentpooltoestemming na 365 dagen. Exporteer dus tijdig, en pas de vastgelegde
bewaartermijn ook toe op de export en back-ups. De export gebruikt direct de
database via SSH; er komt geen publiek endpoint voor persoonsgegevens.

Op de VM (vervang `beheerder` en de datum door je eigen waarden):

```sh
sudo -u aqua-challenge env DB_PATH=/var/lib/aqua-challenge/challenge.db \
  /usr/bin/node /opt/aqua-challenge/scripts/export-leads.js \
  /var/lib/aqua-challenge/leads-2026-10-07.csv
sudo install -m 0600 -o beheerder -g beheerder \
  /var/lib/aqua-challenge/leads-2026-10-07.csv /home/beheerder/leads-2026-10-07.csv
```

Haal het bestand via een **versleutelde SSH-verbinding** naar je eigen computer
(vervang gebruikersnaam en VM-adres):

```sh
scp beheerder@vm.example.nl:/home/beheerder/leads-2026-10-07.csv .
```

Open het CSV-bestand alleen op een beheerde computer. De export bevat
contactgegevens en toestemmingsinformatie; IP-hashes en sessie-ID's blijven
buiten de export. Na controle van de volledige import en een herstelbare
back-up kun je de campagne stoppen met `sudo systemctl disable --now
aqua-challenge.service` en de Caddy-site verwijderen. Let op: na stoppen draait
de automatische opruiming niet meer. Spreek daarom af wanneer de originele
database, back-ups en exportkopieën verwijderd worden; laat ze niet onbeperkt
op de VM staan.
