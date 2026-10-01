# Loomi PMS — self-hosted runtime

Independent Node 24 / Next.js / SQLite version of Loomi PMS. Local accounts, staff/property permissions, signed monthly/yearly/permanent licences, persistent SQLite storage and backup tooling.

Follow the repository root `INSTALL.md` and `compose.yaml`. Run `pnpm install --frozen-lockfile`, `pnpm build`, then `pnpm test` for development validation. HTTP tests require the production build and use temporary databases. Docker must be verified on the target server.

The licence signing tool stays on the Bitwise issuing computer. Never commit private keys, `.env`, passwords, databases or backups. This source contains no live hotel records. It starts with an empty hotel.
