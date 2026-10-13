# Loomi PMS — self-hosted

This source matches the running October 12, 2026 server version. It includes reservations, guests, housekeeping, Swimming Day Passes, Point of Sale, Accounting, Inventory and Operations; local accounts, staff permissions, password changes, licence settings and hotel data reset.

## Install

Requires Docker with Compose. From this directory:

1. Create `secrets/admin_password` containing a password of 12–128 characters. Keep this file private.
2. Set `APP_URL` to the exact application origin, `ADMIN_EMAIL` to the owner email and optionally `ADMIN_NAME`.
3. Run `docker compose up -d --build`.
4. Put a reverse proxy in front of port 3000. For HTTPS, set `COOKIE_SECURE` to `true` in Compose.

The initial owner password is used only to initialize an empty database. Existing accounts and data remain in the `loomi_data` volume. Licence packages are managed in the application by the super-admin.

## Updates and backups

Back up the database consistently using `docker compose exec -T loomi node tools/backup.mjs /app/data/backup.sqlite` and copy the result out with `docker compose cp loomi:/app/data/backup.sqlite ./backup.sqlite`. Store backups privately outside this repository. Back up your deployment configuration too.

Update source, retain your environment settings, secrets and data volume, then run `docker compose up -d --build`. Do not remove the data volume during updates.

## Validation

Production compilation and TypeScript checks were verified on the deployed server. `server-smoke.mjs` exercises application writes and password changes against disposable QA data; never run it against a live customer database.
