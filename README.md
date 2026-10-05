# PAT Plantation — Marketing Executive Report

Responsive executive dashboard for recorded marketing visits. Includes month, quarter and year-to-date comparisons, account and representative reports, an evidence register, and printable board reporting. Activity counts are not verified revenue or sales.

## Public repository safety

This is a fresh, code-only export, not the Replit Git history. It excludes private visit snapshots, contact and meeting data, credentials, the actual Google Sheet ID and URL, uploaded reference images, and the standalone video/design-preview artifacts and their demo media. The running Replit project is unchanged. Google Sheet links are not exposed to report viewers.

## Stack

Node.js 24, pnpm, TypeScript, React + Vite, Express, PostgreSQL + Drizzle, OpenAPI/Orval.

## Run in Replit

1. Import this repository into Replit and use pnpm to install dependencies: pnpm install --frozen-lockfile.
2. Connect Google Sheets with an account authorized to read the original visit table. The backend uses the Replit-managed connector proxy; a plain local Node server does not provide that connector by itself.
3. Configure DATABASE_URL and PLANTATION_SHEET_ID privately in the workspace. Never commit real values. The source sheet is read-only. The expected visit columns are documented in the backend FIELDS list.
4. Initialize the development database with pnpm --filter @workspace/db run push.
5. Start the artifact-managed API and dashboard workflows. Their manifests define ports and paths. The dashboard lives at / and the API at /api.

The public export has no bundled visit-data fallback. If the first source read fails and there is no database cache, the app fails explicitly rather than showing invented records. Later sync failures can use labeled cached data.

## Checks

pnpm run typecheck

pnpm --filter @workspace/executive-report run test

node --test artifacts/api-server/tests/source-privacy.test.mjs

## Before sharing

The report currently has no application-level sign-in. Add access controls before sharing private business data. Removing source links does not change Google sharing permissions; restrict the sheet itself to authorized people.
