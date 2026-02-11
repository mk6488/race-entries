# Race Entries

Admin-gated Vite + React + TypeScript app for managing race entries, equipment, and printable outputs with live Firestore data.

## Tech stack
- Vite (React + TS)
- Firebase Auth (anonymous sign-in) and Firestore
- ESLint + Prettier + CI (typecheck, lint, build)

## Local setup
1) `npm install`
2) Copy `env.example` to `.env.local` and fill values (see below).
3) `npm run dev`

### Scripts
- `npm run dev` — start dev server
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm run typecheck` — TS typecheck
- `npm run build` — typecheck + Vite build

## Environment variables
Set these in `.env.local` (Vite-style `VITE_*`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAILS` (comma-separated allowlist for admin access)

## Roadmap & processes
- Roadmap: `docs/ROADMAP.md`
- Deploy: `docs/DEPLOYMENT.md`
- Admin access: `docs/ADMIN.md`
- Diagnostics: `docs/DIAGNOSTICS.md`
- Printing: `docs/PRINTING.md`
- Backups & recovery: `docs/BACKUP_RECOVERY.md`
- Docs index: `docs/README.md`

## Firebase assumptions
- Anonymous auth is enabled.
- Collections in use: `races`, `entries`, `boats`, `blades`, `divisionGroups`, `silencedClashes`, `silencedBladeClashes`, `gearing`, `admins`.
- Admin gating: `/admins/{uid}` with `{ enabled: true }` controls access to `/diagnostics`.
 - Cloud Functions deploy source: `functions-backend/` (legacy folder moved under `_deprecated/functions-old/functions/`).

## Deployment
- CI runs typecheck/lint/build on PR/main.
- See `docs/DEPLOYMENT.md` for the deploy checklist and verification steps (use `/diagnostics` to confirm version/build).

## Diagnostics (admin-only)
- `/diagnostics` requires an admin doc.
- Tools: trace viewer, Firestore validator (read-only), repair playbook generator (read-only suggestions), diagnostics bundle export.
- No sensitive data is logged; outputs are summaries/ids only.

## Printing/export
- Print styles live in `src/ui/print.css` with helpers: `print-hide`, `print-only`, `print-avoid-break`, `print-break-before/after`.
- See `docs/PRINTING.md` for adding print support to pages.
