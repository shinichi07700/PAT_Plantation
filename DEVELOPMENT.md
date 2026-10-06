# Marketing Executive Report

An executive and board report on marketing company visits from the connected Plantation Report Google Sheet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (default port 5000)
- `pnpm --filter @workspace/executive-report run dev` — run the dashboard frontend (default port 3000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (when Postgres is used)
- Required env:
  - `GOOGLE_API_KEY` — Google Cloud API key with access to Google Sheets API
  - `PLANTATION_SHEET_ID` (optional, defaults to `1b-RY5WAl2I68iflXML9JHt70hY9nMhdYbbs0pgpfAVQ`)
  - `DATABASE_URL` (optional) — PostgreSQL connection string for caching report data

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/executive-report` — responsive executive report, period analysis and drilldowns.
- `artifacts/api-server/src/lib/sheets-report.ts` — read-only Sheets synchronization, validation and labeled fallback.
- `lib/api-spec/openapi.yaml` — report API contract; regenerate clients after edits.

## Architecture decisions

- The sheet is the source of truth; the app must never write to it.
- Never expose the Google Sheet URL or spreadsheet ID in browser-facing data, report links, or printed reports. Keep source row references as plain text only; source access stays server-side.
- Counts describe recorded activity, not verified financial outcomes. "Closing" is an activity label, not proof of booked revenue.
- Record-date bounds are not a guarantee of complete reporting. Missing historical coverage is unavailable, not zero performance.
- A planned follow-up date passing does not establish that the action remains incomplete; completion is not tracked in the source.

## Product

Time-filtered executive reporting for C-Level and BOD: current month, previous month, quarter and year-to-date with prior-period comparisons, account and representative analysis, original meeting evidence and printable board reports.

## User preferences

The user requested an executive report for C-Level and BOD and explicitly asked that the UI not use an "AI Slop design".

The user's existing PT Prima Agro Tech Plantation Report dashboard is the visual reference: improve its compact, dark, data-first presentation rather than replace it with a long editorial report. Preserve useful representative, activity-type and company comparisons.

## Gotchas

- Business dates use Asia/Jakarta. Filter by activity date rather than submission timestamp.
- The Sheets connection is read-only. Only read the visit table; unrelated user lists and attachment files are outside this report.
- The saved source snapshot and runtime API contain private business notes. No app-level authentication has been added; add access controls before publishing or sharing outside the intended audience.
- Cached data must show its source date and sync error, never masquerade as fresh live data. This public code export contains no embedded report snapshot.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
