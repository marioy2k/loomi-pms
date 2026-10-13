# Loomi PMS — self-hosted

This source matches the running October 12, 2026 server version. It includes reservations, guests, housekeeping, Swimming Day Passes, Point of Sale, Accounting, Inventory and Operations; local accounts, staff permissions, password changes, licence settings and hotel data reset.

## Install

Requires Docker with Compose. From this directory:

1. Create `secrets/admin_password` containing a password of 12–128 characters. Keep this file private.
2. Set `APP_URL` to the exact application origin, `ADMIN_EMAIL` to the owner email and optionally `ADMIN_NAME`.
3. Run `docker compose up -d --build`.
4. For direct access without a reverse proxy, set `LOOMI_BIND_ADDRESS` to the server's LAN IP and `LOOMI_HTTP_PORT` to `80`. For example, set `LOOMI_BIND_ADDRESS=10.10.111.47` and `APP_URL=http://10.10.111.47` before starting Compose; open `http://10.10.111.47`. The port binds only to that IP. By default it binds to `127.0.0.1:80`.
5. If deploying behind an HTTPS reverse proxy instead, choose the appropriate local bind address/port, set `APP_URL` to the HTTPS origin and set `COOKIE_SECURE` to `true` in Compose.

The initial owner password is used only to initialize an empty database. Existing accounts and data remain in the `loomi_data` volume. Licence packages are managed in the application by the super-admin.

## Updates and backups

Back up the database consistently using `docker compose exec -T loomi node tools/backup.mjs /app/data/backup.sqlite` and copy the result out with `docker compose cp loomi:/app/data/backup.sqlite ./backup.sqlite`. Store backups privately outside this repository. Back up your deployment configuration too.

Update source, retain your environment settings, secrets and data volume, then run `docker compose up -d --build`. Do not remove the data volume during updates.

## Validation

Production compilation and TypeScript checks were verified on the deployed server. `server-smoke.mjs` exercises application writes and password changes against disposable QA data; never run it against a live customer database.

## Automatic backup status

My account shows the signed-in user's name, email and role. Backup & restore shows server backup metadata only to Super Admins with backup access.

On a systemd server with the existing `loomi-backup.service` and `loomi-backup.timer`, install `tools/backup-status.py` as `/usr/local/sbin/loomi-backup-status` and the two units in `deploy/` into `/etc/systemd/system/`. Run `systemctl daemon-reload`, `systemctl enable --now loomi-backup-status.timer`, and `systemctl start loomi-backup-status.service`. Add a read-only Compose bind mount `/var/lib/loomi/backup-status:/run/loomi-backups:ro` to the Loomi service and recreate the container. No database or Docker socket is exposed through this mount. The status is refreshed every minute; the app flags metadata older than five minutes. Times are displayed in America/Paramaribo, using the timer's actual next run rather than assuming a timezone.
