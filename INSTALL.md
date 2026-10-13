# Loomi PMS installation

The current Docker and SQLite server version is in `self-hosted/`. See [the self-hosted installation guide](self-hosted/README.md) for setup, backups and updates. The repository root retains the original hosted source.

Run Compose from `self-hosted/`, or use the root Compose file with the same environment settings. Both configurations use the password file at `self-hosted/secrets/admin_password`. Keep existing deployments' credentials and persistent data volumes when updating.
