# Deprecated legacy Cloud Functions folder

This folder exists only to preserve history from earlier iterations of the Cloud Functions codebase.

## Current source of truth

Cloud Functions are deployed from `functions/` (Gen2 TypeScript).

## Safety rails

- `firebase.json` points functions deployment at `functions/`.
- Root `.firebaseignore` ignores this deprecated area.

