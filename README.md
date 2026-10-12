![Loomi logo](public/loomi-logo.png)

*Loomi: Turn on the brilliant way to manage stays.*

# Loomi PMS

Hotel property management by Bitwise MSP.

The repository root preserves the original hosted source. The independent Ubuntu/Docker application is in `self-hosted/`. Follow [INSTALL.md](INSTALL.md) to configure HTTPS, owner credentials, signed monthly/yearly/permanent licences and persistent storage.

The self-hosted version includes local logins, staff permissions, assigned properties, housekeeping, guest history, accounting and USD/SRD/EUR. Cash and card are bookkeeping methods, not card processing. The production Node build and four automated tests passed; Docker itself needs validation on the server. Existing hosted guest data has not been migrated.

Keep this repository private. Never commit guest data, backups, passwords or licence signing keys. This release has not received an independent security audit.

Support: +5977238113 / support@bitwisesr.com.

## Release naming

Current release: **Loomi v1.0.0 — First Light**. The version is visible in the app footer and Settings / About Loomi, alongside the latest changes. License remaining days and expiry details are restricted to the self-hosted super admin.

Group related changes into a release. Bump **minor** for new features, **patch** for fixes, and **major** for incompatible changes. Run from the repository root with Node:

```bash
node tools/release.mjs minor "Morning Glow" "Added reporting"
```

The command updates both app package versions and their release manifests together. Commit the resulting files with the feature changes, then deploy the release. Version numbers change when a release is prepared, rather than on every file edit.
