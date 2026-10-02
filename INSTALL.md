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
node self-hosted/tools/licence.mjs issue bitwise-private.pem INSTALLATION_ID "Customer hotel" yearly 5 customer-licence.json
```

Replace `yearly` with `monthly` or `permanent` as needed. The number is the maximum properties. Upload the JSON file from the owner's activation screen. Missing, expired, tampered or other-installation licences block PMS APIs and the dashboard. Renewal currently requires uploading a newly issued file after expiration; there is no automatic billing or licence portal. Licences work offline. Keep the server time correct.

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

## n8n and AI integration

This release includes scoped bearer tokens and an owner approval queue under **Settings → Integrations & AI**. See [N8N.md](self-hosted/N8N.md) for endpoints, permissions, n8n setup, idempotency and signed webhook verification. The [OpenAPI reference](self-hosted/openapi.json) describes v1 requests and responses.

For outgoing webhook delivery, configure the trusted n8n origin in `.env` before startup, for example `LOOMI_WEBHOOK_ALLOWED_ORIGINS=https://n8n.your-domain.com`. The Compose `webhook-worker` service runs beside Loomi and shares its database. No destinations are allowed by default. After deployment, check `docker compose ps` and `docker compose logs --tail=50 webhook-worker`, then test an event with a receiver that verifies signatures and deduplicates event IDs. No n8n workflows or AI credentials are created automatically.
