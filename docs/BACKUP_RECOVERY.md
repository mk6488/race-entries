## Firestore backups & recovery

> Keep backups secure. Exports may contain personal data. Store outputs in restricted buckets/folders and avoid sharing publicly.

### Recommended approach (managed exports)
- Use Firestore managed export to a Cloud Storage bucket (e.g., `gs://<project>-firestore-backups`).
- Schedule exports (e.g., Cloud Scheduler + Cloud Functions/Workflows) for the full database.
- Retention example: daily for 14 days, weekly for 8 weeks, monthly for 12 months. Adjust to policy.
- Always back up to a project-owned bucket with restricted access.

Run a one-off export (console/gcloud):
```bash
gcloud firestore export gs://<bucket>/backups/$(date +%Y%m%d_%H%M%S) \
  --project $FIREBASE_PROJECT_ID
```

### Manual developer export (local JSON, optional)
- Script: `node scripts/export-firestore.mjs --out backups`
- Reads only; writes JSON locally under `backups/<timestamp>/`.
- Env required: `FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path with read access).
- Optional flags:
  - `--collections races,entries,...` (default: all core collections)
  - `--limit 500` (per collection)
- Do **not** commit backup outputs; store securely.

### Recovery playbook
1) **Freeze changes**: announce, pause edits if possible.
2) **Identify last good backup**: timestamp + scope.
3) **Restore to a new Firestore project first** (preferred):
   - Import managed export into a test project.
   - Point local env to test project; run the app locally.
   - Use `/diagnostics` validator (read-only) against restored data.
4) **Validate**:
   - `/diagnostics` version shows expected build.
   - Core smoke tests: Home, Entries, Race.
   - Print sanity check on a key page (if relevant).
5) **Production decision**:
   - If test restore passes, restore to production or re-point clients (per release plan).
   - Communicate completion and unfreeze edits.

### Notes
- No Firestore rules or shapes are changed by these steps.
- For bug investigations, export a Diagnostics Bundle from `/diagnostics` and attach it to the issue before recovery actions.
