# Loomi PMS

Hotel property management application by Bitwise MSP.

## Implemented

- Multiple properties with separate rooms, reservations, guest records and accounting.
- Administrator and employee permissions, including assigned-property access.
- Room availability with available/busy indicators, check-in and check-out.
- Guest stay history and optional identification details (ID card, passport, driver licence).
- Accounting ledger, income/expenses, cash/card methods, USD/SRD/EUR filters and CSV export.
- Housekeeping dashboard and in-app alerts; optional browser notifications while the application is open.
- Bitwise MSP support footer.

## Current runtime

This repository contains the current hosted source. It uses React, Vinext, Cloudflare Workers and D1, with platform-provided ChatGPT authentication. Database schema and migrations are included in `db/` and `drizzle/`.

**It is not yet a standalone Docker installation for Ubuntu.** Local database access, independent staff authentication, Docker deployment and migration of live records still need implementation.

Monthly, yearly and permanent licensing are planned, but **not implemented**. PWA installation, background push notifications and a complete security review are also pending.

## Development

Use Node.js 22 or later and pnpm. Install dependencies with `pnpm install`. The current build is `pnpm build`; it targets Cloudflare Workers. D1 migrations are generated with `pnpm db:generate` and must be applied through the hosting platform or Wrangler. Local binding setup and platform authentication are required for the hosted application to function.

The repository stores source code, not live guest data, database backups, credentials or licence signing keys. Treat real guest information as sensitive. Do not deploy this source as a production on-premises product without completing the runtime migration and security validation.

## Support

Powered by Bitwise MSP. Call or WhatsApp +5977238113, or email support@bitwisesr.com.
