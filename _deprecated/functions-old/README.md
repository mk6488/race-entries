# Deprecated legacy Cloud Functions folder

This folder exists only to preserve history and any old experiments/config that previously lived under the legacy
`functions/` directory.

## Why deprecated

- The project’s Cloud Functions deploy source of truth is `functions-backend/`.
- Having two functions folders makes it easy to deploy the wrong thing by accident.
- Firebase deploy is configured to build and deploy from `functions-backend/` only.

## How to deploy functions now

From the repo root:

- Build: `npm --prefix functions-backend run build`
- Deploy: `firebase deploy --only functions`

Or from inside `functions-backend/`:

- `npm run build`
- `npm run deploy`

## Safety rails

- `firebase.json` points functions deployment at `functions-backend/`.
- Root `.firebaseignore` ignores this deprecated area.

