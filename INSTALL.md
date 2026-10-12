# Loomi PMS on Ubuntu with Docker

The repository root is the original hosted source. The independent Node/SQLite version is in `self-hosted/`. Use the root `compose.yaml` for your server. Each company gets a separate installation and database. This installation starts empty; existing hosted records are not automatically migrated.

## 1. Prepare the server

Docker Engine and the Compose plugin must already be installed. Clone this private repository using your own GitHub credentials:

```bash
git clone https://github.com/marioy2k/loomi-pms.git
cd loomi-pms
mkdir -p secrets
chmod 700 secrets
```

Create `.env` with your real HTTPS address and owner login:

```text
APP_URL=https://pms.your-domain.com
ADMIN_EMAIL=your-email@example.com
ADMIN_NAME=Romario
```

Create the initial password without putting it in shell history:

```bash
read -rsp 'Owner password (12–128 characters): ' LOOMI_PASSWORD
printf '%s' "$LOOMI_PASSWORD" > secrets/admin_password
unset LOOMI_PASSWORD
chmod 600 secrets/admin_password
```

The password file bootstraps the owner once. Changing it later does not reset an existing account. Keep it outside GitHub.

## 2. Create the Bitwise licence keys

On your separate Bitwise issuing computer with Node 24:

```bash
node self-hosted/tools/licence.mjs keygen bitwise
```

Keep `bitwise-private.pem` only on that computer and back it up securely. Never copy it to a customer server or commit it. Copy `bitwise-public.pem` to the customer server as `secrets/licence_public_key`. This public key verifies licences and is not secret.

## 3. Start the application

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 loomi
```

The service listens on the server's loopback port 3000. Configure your HTTPS reverse proxy to forward your domain to `127.0.0.1:3000`. If your proxy runs in Docker, connect it to this Compose network and use `loomi:3000`. Do not use `127.0.0.1` inside a different container. Set DNS to the server and issue a valid TLS certificate through your proxy. The configured `APP_URL` must exactly match the browser origin.

Open your HTTPS address and sign in. Secure cookies intentionally require HTTPS. The activation screen shows the installation ID.

## 4. Issue and activate a licence

On the Bitwise issuing computer, use the installation ID shown on that server:

```bash
node self-hosted/tools/licence.mjs issue bitwise-private.pem INSTALLATION_ID "Customer hotel" yearly 1 standard customer-licence.json
```

Replace `yearly` with `monthly` or `permanent` as needed. The number is the maximum licensed properties. Choose `small`, `standard` or `hotel`:

| Plan | Suggested rooms | Maximum rooms per property | Monthly USD/property | Annual USD/property |
| --- | --- | --- | --- | --- |
| Small | 1–10 | 10 | $49 | $490 |
| Standard | 11–25 | 25 | $89 | $890 |
| Hotel | 26–50 | 50 | $149 | $1,490 |

Only the maximum is enforced; new properties can start with zero rooms. Every configured room, including out-of-service rooms, counts. Each licensed property receives the same cap; subscription totals multiply the price by the licensed property count. Permanent licences use a custom quote and retain monthly/yearly reference prices.

The plan, room cap and USD prices are signed into the licence. Old licences without these fields must be reissued using the same installation ID and signing key before updating the application; otherwise activation is required. Choose a plan covering all existing rooms. Over-cap downgrades are rejected.

The installation owner is the super admin. Only this account sees **Settings → Licence & pricing**, including signed prices, subscription totals, room usage and a renewal/upgrade upload. The super admin also sees pricing on the activation screen after expiry. Staff and ordinary admins cannot access licence pricing.

 Upload the JSON file from the owner's activation screen. Missing, expired, tampered or other-installation licences block PMS APIs and the dashboard. Renewal requires uploading a newly issued file in Settings or on the activation screen; there is no automatic billing. Licences work offline. Keep the server time correct.

Server owners with root access can modify software and bypass local enforcement. Signing prevents customers from generating valid licences; it cannot prevent a determined server owner from changing the application code.

## 5. Configure the hotel

Add rooms and hotel details in Settings. Add employee passwords and assigned properties under Settings → Staff and permissions. Housekeeping employees should receive housekeeping access and their assigned properties. Use separate accounts and securely share initial passwords. Card/cash records are bookkeeping entries; this app does not charge bank cards or store card numbers.

## Backups and restores

Create a consistent SQLite backup, then copy it off the server:

```bash
docker compose exec loomi node tools/backup.mjs /app/data/backup.sqlite
docker compose cp loomi:/app/data/backup.sqlite ./backup.sqlite
```

Backups include guest data, accounts and licence state. Encrypt off-server backups and restrict access. Keep multiple dated copies. Test a restore on a separate instance. To restore, stop the app, replace `/app/data/loomi.sqlite` in its named volume with the backup, remove old `loomi.sqlite-wal` and `loomi.sqlite-shm`, ensure UID 1000 owns the restored file, and restart. Restore the public key configuration too. Never run `docker compose down -v` on a live system: it deletes the database volume.

## Updates

Back up first. Commit feature changes to `self-hosted/`, then on the server:

```bash
git pull --ff-only
docker compose up -d --build
```

Schema migrations apply on startup. Review migrations before updating; restore a compatible backup if a release must be rolled back. Hosted source changes do not automatically update `self-hosted/`.

## Validation and limits

Node production build, password/session tests, licence signature/expiry tests and SQLite transaction/backup tests are checked. Docker itself was unavailable in the development environment; the image must be built and checked on your Ubuntu server before production use. This is an initial self-hosted release, not an independent security audit. SQLite files are not encrypted by this application; use disk encryption and restricted server access. There is no MFA, forgotten-password email flow, background mobile push or PWA installation yet. Browser alerts run while the application is open. Keep the GitHub repository private, keep dependencies updated, use HTTPS, and test staff permissions with test accounts before adding real guests.

Powered by Bitwise MSP — +5977238113 — support@bitwisesr.com.


## Super-admin hotel data reset

Settings / Reset data clears rooms, reservations (including guest identification and history), and accounting transactions across all properties. Only the installation owner can call this endpoint. The confirmation phrase is `RESET ALL HOTEL DATA`. Property names/currencies, accounts, staff permissions, installation ID, licence and audit history remain. Back up before use; the app has no undo. Reset is transactional, is audited, and retains ledger initialization markers to prevent stale accounting requests from re-importing opening balances. Other open sessions must reload.

## 21-day free demo

Issue a signed `demo` licence using the same plan and property-count arguments as paid licences:

```bash
node self-hosted/tools/licence.mjs issue bitwise-private.pem INSTALLATION_ID "Hotel name" demo 1 standard demo.json
```

The demo lasts exactly 21 days from issuance (UTC), uses the selected room cap, and has no automatic billing. Re-uploading the same file does not restart the demo. At expiry, records remain stored but a paid licence is required to resume operations. The super admin can upload the paid licence from the activation screen without losing demo records. The issuing computer controls demo grants; Loomi does not automatically issue repeat demos.

## Optional add-ons and licence version 2

Choose a room package first, then extras. Core PMS keeps reservations, rooms, guests, basic housekeeping and recording guest payments. All prices below are USD per licensed property; annual subscriptions give two months free.

| Optional add-on | Monthly | Annual | Availability |
| --- | --- | --- | --- |
| Swimming Day Passes | $15 | $150 | Planned; not sold yet |
| Point of Sale | $25 | $250 | Planned; not sold yet |
| Accounting | $20 | $200 | Available: ledger, income/expenses and transaction filters |
| Operations | $20 | $200 | Planned: advanced task and maintenance workflows |

New paid licences default to core PMS only. Add `accounting` after the output filename to include Accounting, or `none` to explicitly choose core only:

```bash
node self-hosted/tools/licence.mjs issue bitwise-private.pem INSTALLATION_ID "Customer hotel" yearly 1 small customer-licence.json accounting
```

Small plus Accounting costs $69/month or $690/year per property. One signed licence contains the room package, selected add-ons and combined price. Selected add-ons apply to every licensed property. Changing the selection requires a newly signed licence and owner activation; the estimate in Settings does not enable modules or bill anyone. Paid issuance rejects planned modules until implemented. Existing signed room-plan licences preserve Accounting until renewal, without changing their stored signed price. No existing licence is overwritten automatically. Older licences without any room plan still require reissue.

Every newly issued demo includes all four add-on entitlements for 21 days at no charge; only implemented modules can be used. Accounting checks the signed entitlement on the server as well as in navigation. Guest payment recording remains available without Accounting and ledger records remain stored if Accounting is disabled. Prices, estimates, expiry and licence uploads remain super-admin only; staff receive only enabled add-on IDs.
