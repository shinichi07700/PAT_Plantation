# PAT Plantation — Marketing Executive Report

Responsive executive dashboard for recorded marketing visits. Includes month, quarter and year-to-date comparisons, account and representative reports, an evidence register, and printable board reporting. Activity counts are not verified revenue or sales.

## Public repository safety

This codebase is configured to run standalone with a Google Sheets API key. It excludes private visit snapshots, contact and meeting data, credentials, and uploaded reference images. Google Sheet links and credentials are kept server-side and are never exposed to report viewers.

## Stack

Node.js 24, pnpm, TypeScript, React + Vite, Express, PostgreSQL + Drizzle, OpenAPI/Orval.

## Getting Started

1. Install dependencies using pnpm: `pnpm install`.
2. Configure environment variables (create a `.env` file based on `.env.example`):
   - `GOOGLE_API_KEY`: Google Cloud API key with access to Google Sheets API v4.
   - `PLANTATION_SHEET_ID`: (Optional) Defaults to `1b-RY5WAl2I68iflXML9JHt70hY9nMhdYbbs0pgpfAVQ`.
   - `DATABASE_URL`: (Optional) PostgreSQL connection string for caching report data.
3. If PostgreSQL is configured, initialize the database schema:
   `pnpm --filter @workspace/db run push`
4. Start development servers:
   - Backend API: `pnpm --filter @workspace/api-server run dev` (runs on http://localhost:5000)
   - Frontend Dashboard: `pnpm --filter @workspace/executive-report run dev` (runs on http://localhost:3000)

## GitHub Pages Deployment

This project includes automated deployment to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`):

1. **Enable GitHub Pages**:
   - Go to your repository on GitHub: `Settings` > `Pages`.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
2. **Add Secret**:
   - Go to `Settings` > `Secrets and variables` > `Actions`.
   - Click **New repository secret**.
   - Name: `GOOGLE_API_KEY`
   - Value: Your Google Cloud API key (with Google Sheets API enabled).
3. **Deploy**:
   - Push to `main` branch, or trigger the workflow manually from the **Actions** tab.
   - The workflow runs, pulls the sheet data, builds the dashboard, and publishes it at:
     `https://shinichi07700.github.io/PAT_Plantation/`

## Checks

pnpm run typecheck

pnpm --filter @workspace/executive-report run test

node --test artifacts/api-server/tests/source-privacy.test.mjs

## Before sharing

The report currently has no application-level sign-in. Add access controls before sharing private business data. Removing source links does not change Google sharing permissions; restrict the sheet itself to authorized people.
