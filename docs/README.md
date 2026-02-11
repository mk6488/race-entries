# Docs index

## Cloud Functions source of truth

Cloud Functions are deployed from `functions-backend/` only.

The legacy `/functions/` folder is not used for deployment and is intentionally ignored (see `firebase.json` and `.firebaseignore`).

## Netlify environment variables

Set this in Netlify (Site settings → Build & deploy → Environment):
- `VITE_FUNCTIONS_REGION` (default: `europe-west2`)


