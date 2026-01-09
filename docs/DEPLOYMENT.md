## Deployment

1) Ensure local checks pass:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`

2) Push to `main` (CI runs typecheck/lint/build).

3) After deploy:
   - Open `/diagnostics` (admin-only) and confirm:
     - Version/build time match the latest commit
     - No errors in trace
     - Validator/playbook accessible

4) Smoke tests:
   - Open Home, Entries, Race pages
   - Add/edit an entry (in a test race)
   - Print preview on a key page to ensure styles are intact

### Notes
- Diagnostics and validator are read-only; they will not write to Firestore.
- Admin access is required for `/diagnostics` (see `docs/ADMIN.md`).
