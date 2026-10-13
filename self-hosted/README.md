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

## Domain login

Set `APP_URL` to the exact address used in the browser. When using `https://loomi.bitwisesr.com`, set `APP_URL=https://loomi.bitwisesr.com` and `COOKIE_SECURE=true` in the service environment, then recreate the container. To also use the LAN IP, set `ALLOWED_ORIGINS=http://10.10.111.47` and `COOKIE_SECURE=auto`. This keeps cookies secure on HTTPS and permits host-only cookies on the explicitly allowed HTTP IP. Sign in separately on each address; sessions are not shared between hosts. The public HTTPS proxy can forward to `http://10.10.111.47:80`; Nginx is not required on the Loomi server. Writes are accepted only from `APP_URL` or the comma-separated `ALLOWED_ORIGINS`; all other origins are rejected.

## Staff teams and independent permissions

Choose Front desk, Housekeeping, Accounting, Cashier/POS, Swimming or Maintenance when editing staff, then grant or remove each action. Collecting reservation payments, refunding reservation payments, changing nightly rates, viewing Accounting and editing Accounting are separate permissions. Swimming sales, voucher redemption, pool settings and refunds are independent of Accounting and POS. Presets replace the selected actions when explicitly chosen; later checkbox changes retain the team label. Existing payment/rate access is preserved once by migration 0013; unintended swimming access is removed. Super Admins retain full access and the owner is protected.

Accounting opens on Payments and shows money received, money paid out, guest balances and held deposits. Paid guests stay visible in Guest balances. Reservation changes refresh Accounting automatically; Refresh payments reloads saved records. Profit reports still use completed nights rather than payment receipt dates.

## Interface language

The top-right English and Dutch flag buttons are available on the login and application screens. The choice is saved in this browser using `loomi-language`. Labels and help text are translated through React components; dates and currency on the reservation and Accounting screens use the selected locale. Reservation/payment identifiers, guest-entered names and notes, permissions and saved financial amounts retain their original values. Switching language does not reload the application or reset form state.
