# Bitwise licence desk

A separate, self-hosted super-admin dashboard for issuing Loomi PMS licences. It contains no customer PMS runtime and needs no Loomi licence itself. This dashboard has not been deployed to a server.

- One Bitwise super-admin account, configured outside the application.
- Customer company and contact records.
- Monthly, yearly and permanent licences with property limits and purchased modules.
- Renewals and replacements for the latest licence of an installation.
- Signed JSON downloads compatible with Loomi's existing activation screen.
- Public-key download and fingerprint, plus issuance/download activity history.
- Persistent SQLite records, session authentication, login throttling, origin checks and a restrictive content security policy.
- No npm dependencies. Requires Node.js 24 or the included Docker image.

The private Ed25519 signing key stays on this Bitwise installation. Customer servers receive only its public verification key and their generated licence file. The dashboard never returns the private key through an API or includes it in a download or database record. Keep the private key out of GitHub, customer servers, browser storage and the container image.

## Deployment preparation

From the repository's `license-dashboard` folder:

1. Prepare secrets using Node.js 24. If customer licences already exist, reuse the ORIGINAL signing key:

   ```bash
   node tools/setup.mjs secrets /secure/path/loomi-private.pem
   ```

   For a brand-new issuer with no existing licences, generate a new key instead:

   ```bash
   node tools/setup.mjs secrets
   ```

   Setup refuses to overwrite existing secrets. It writes `secrets/signing_key`, `secrets/admin_password` and `secrets/loomi-public.pem`. Read the generated password locally; it is not printed by setup. Back up the signing key securely before issuing licences. Losing it prevents issuing upgrades trusted by customer installations that use its public key.

2. Copy `.env.example` to `.env`. Set your Bitwise super-admin email and the private HTTPS URL you will use. The URL must match the browser origin exactly. Never use a customer email as the dashboard's super-admin account.

3. For Linux Docker deployments, the application runs as UID/GID 1000. Ensure it can read the two private secret files without making them world-readable:

   ```bash
   sudo chown 1000:1000 secrets/signing_key secrets/admin_password
   sudo chmod 600 secrets/signing_key secrets/admin_password
   ```

4. Start it when you are ready to work on the server:

   ```bash
   docker compose up -d --build
   ```

   Docker exposes port 3200 on the host's loopback interface only. Put your HTTPS reverse proxy in front of this endpoint and restrict access to the NetBird VPN. A proxy in another container cannot use its own `127.0.0.1` to reach this port; configure an appropriate private connection on the same host. Proxy the chosen HTTPS hostname to the dashboard and preserve the browser's `Origin` header. Do not expose it directly on a public interface. The application itself provides HTTP behind your HTTPS proxy.

5. Open the configured HTTPS address through NetBird and sign in with the email in `.env` and password in `secrets/admin_password`.

These files prepare deployment; no DNS, VPN, proxy or server changes are performed by creating this project.

## Issuing a licence

Add the customer's company. Choose Issue licence and paste the Installation ID from their Loomi activation screen. Select a subscription term, property limit and optional modules, then generate and download the JSON file.

The core package includes rooms/properties, reservations, guests, stay invoices and accommodation payments. Optional modules are Housekeeping, Accounting, POS, Swimming passes, Inventory, and Integrations & AI. Selecting none creates a core-only licence.

Place the public verification key on the CUSTOMER server at `secrets/licence_public_key`, relative to Loomi's Compose file. The customer uploads the generated JSON on their activation screen. For an upgrade or renewal, they use Settings → Company features → Upload replacement licence. This dashboard does not remotely install licences or connect to customer servers.

## Renewals and replacements

Use Renew / replace on the latest licence. It retains the customer and Installation ID, while you can change the term, property limit and purchased modules. Monthly/yearly renewals extend from the later of the current expiry or issuance time. Month ends and leap days are clamped to the last day of the destination month. Permanent licences have no expiry. Customer company renames apply to new files; previous licence snapshots remain unchanged.

Each issuance request is idempotent: retrying the same request cannot generate a second file. A replaced licence cannot be used as the base of a second replacement; use the newest file. An installation cannot be reassigned to another customer through the issuance form.

Offline customer licences cannot be remotely revoked. A replacement does not invalidate a previously downloaded file before its expiry. This dashboard records which file replaced another without claiming that older signatures have been revoked. It does not automatically bill customers or send licences by email.

## Passwords, keys and backups

Changing the super-admin email or password happens outside the UI: update `.env` or the password secret and recreate the container. All existing sessions are removed on restart. Sessions expire after eight hours. Ten failed sign-in attempts from the same connection address trigger a 15-minute block; behind a reverse proxy this is a conservative shared lockout. This application does not use caller-supplied forwarded-IP headers.

Back up the SQLite database with the supplied tool:

```bash
docker compose exec licence-desk node tools/backup.mjs /app/data/issuer-backup.sqlite
docker compose cp licence-desk:/app/data/issuer-backup.sqlite ./issuer-backup.sqlite
```

Use a new backup filename for each backup. Keep database backups and the private signing-key backup secure and separate. The database backup contains customer records, generated envelopes and audit history, but not the signing key. Restore the original database and original signing key together. Key rotation requires distributing a matching public key to affected customer installations; do not replace the signing key casually.

## Local development and tests

For local HTTP development only, set `APP_URL=http://127.0.0.1:3200`, `ALLOW_INSECURE_LOCALHOST=true`, `SUPER_ADMIN_EMAIL`, `ADMIN_PASSWORD_FILE`, `SIGNING_KEY_FILE` and `DATA_DIR`, then run `npm start`. HTTP is rejected for non-localhost origins. Production uses Secure, HttpOnly, SameSite=Strict cookies.

Run `npm run check` and `npm test`. Tests use temporary keys and databases. They verify Ed25519 signatures, Loomi activation compatibility when the sibling self-hosted source is present, idempotent issuance, paid renewal time, customer snapshots, super-admin authentication, CSRF protection, downloads, logout and throttling. No live customer key or server is used.
