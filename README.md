# Loomi PMS

Hotel property management by Bitwise MSP.

The repository root preserves the original hosted source. The independent Ubuntu/Docker application is in `self-hosted/`. Follow [INSTALL.md](INSTALL.md) to configure HTTPS, owner credentials, signed monthly/yearly/permanent licences and persistent storage.

The self-hosted version includes local logins, staff permissions, assigned properties, housekeeping, guest history, accounting and USD/SRD/EUR. Cash and card are bookkeeping methods, not card processing. The production Node build and four automated tests passed; Docker itself needs validation on the server. Existing hosted guest data has not been migrated.

Keep this repository private. Never commit guest data, backups, passwords or licence signing keys. This release has not received an independent security audit.

Support: +5977238113 / support@bitwisesr.com.
