# Loomi PMS — self-hosted

This source matches the running October 22, 2026 server version. It includes reservations, guests, housekeeping, Swimming Day Passes, Point of Sale, Accounting, Inventory and Operations; local accounts, staff permissions, password changes, licence settings and hotel data reset.

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

Choose English or Dutch in Settings → Language. The selector is available to every signed-in account; the login screen also respects the saved choice. The choice is saved in this browser using `loomi-language`. Labels, help text, notifications, fixed status/category names and generated receipt/invoice/voucher labels are translated through React components and shared helpers; dates and currency on the reservation and Accounting screens use the selected locale. Reservation/payment identifiers, guest-entered names and notes, permissions and saved financial amounts retain their original values. Switching language does not reload the application or reset form state.

## Reservation currencies

New reservations can use USD, EUR or SRD independently of the property's default room/POS currency. Choosing a currency clears the draft nightly rate and payment so staff enter amounts in that currency; no automatic exchange rate is used. Saved reservation currencies are fixed. Legacy bookings without a currency continue to use the property currency. Payments, refunds, guest history, policy balances and reports follow each reservation's currency. Outstanding amounts and property performance are grouped by currency. Room/POS charges retain their own currency; invoices offer separate currency views when a reservation has charges in more than one currency.


## Vehicle security

See [VEHICLE-MANAGEMENT.md](VEHICLE-MANAGEMENT.md) for vehicle departures, returns, defect photos, security staff permissions and supervisor release.

## October 22 server updates

Includes UniFi guest Wi-Fi management, staff chat with attachments and linked records, browser push notifications, team conversations, session presence, and EUR display fixes. Database migrations 0018–0022 accompany these features. The Compose file remains configurable; server-specific settings, passwords and guest data are excluded.

## Responsive layout and security maintenance — October 22

Summary cards, filters, forms and dialogs adapt to phone and tablet widths. Settings tabs wrap within the workspace; mobile navigation closes after selection and returns to the top of the selected screen. Wide record tables scroll within their panel.

Next.js is pinned to 16.4.1 and React/React DOM to 19.2.9. Transitive security patches are recorded in `pnpm-workspace.yaml`; retain that file when building. Login limits apply per account, with a separate short global flood limit, and credential request bodies are capped at 4 KB. Booking requests enforce each staff member’s assigned properties.

## Optional sidebar auto-hide

Open **Settings → Sidebar** to turn **Auto-hide sidebar** on or off. When enabled, the sidebar opens when the pointer is within 16 pixels of the left edge and hides shortly after the pointer leaves. It overlays the workspace instead of moving its contents. Keyboard navigation, the sidebar button and Ctrl/Cmd+B remain available. The menu stays open while editing sidebar controls or using a visible pop-up opened from that sidebar. Hidden chat windows and unrelated dialogs do not block auto-hide. Escape closes the menu, and leaving the window clears its hover state. The preference is saved in this browser. Phones and touch-only devices retain manual navigation.

Reservation discounts: choose Percentage or Fixed amount when creating or editing a stay. The discount applies once to the accommodation subtotal in the reservation currency, excluding POS charges. Staff need nightly-rate permission to change discounts. Invoices show a separate discount line; balances, deposits, cancellation fees, payment reminders and accommodation income use the discounted total. Existing payments remain recorded, with any excess shown as accommodation credit.

## Light and dark mode

Use the sun/moon button at the bottom right of any page, including sign-in and the guest booking page. The first visit follows the device preference; choosing a mode saves it in this browser and synchronizes it across open Loomi tabs. The button sits next to the chat launcher. Documents continue to print on a light background.

## Accounting business dates

Reservation receipts, refunds and opening balances use `America/Paramaribo` business dates; UTC creation timestamps are retained for audit. Manual cash payments cannot be future-dated. Security-deposit mutations must keep every affected daily held balance between zero and the required deposit. Cancelled reservations with fees or payments remain visible in guest balances.

For older automatic reservation receipts affected by UTC dating, `node tools/repair-reservation-dates.mjs` performs a read-only dry-run. After reviewing the IDs and taking a database backup, apply only selected rows with `--apply --id TRANSACTION_ID` (repeat `--id` as needed). The tool changes only eligible business dates, retains amounts and timestamps, records both accounting and activity audit events, and safely recognizes retries. Manual accounting entries are excluded.

## Delete chats and groups

In an open team conversation, use the trash button to delete the conversation for yourself, then confirm. Existing messages, files, pinned notes, search results and notifications disappear from your view; colleagues retain their copies. New messages bring the conversation back. Search the colleague or group name to start again yourself. The cutoff synchronizes across sessions and is included in backups.

Group creators and company administrators who are current members can open **Manage group → Delete group for everyone**. After explicit confirmation, this permanently deletes the group and its messages, attachments, receipts, pins and record links. Group membership/version is checked again on the server; ordinary members can only clear their own view. Deletion is audited.
