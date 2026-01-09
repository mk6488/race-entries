## Diagnostics (admin-only)

Path: `/diagnostics` (requires `/admins/{uid}` with `enabled: true`).

### Tools
- **Trace viewer**: recent trace events (dev-focused; no sensitive data).
- **Validator**: read-only Firestore scan (default limited sample). Reports missing/invalid fields and mapper fallbacks.
- **Repair playbook**: turns validator issues into suggested safe fixes (no writes; manual action only).
- **Bundle export**: exports current diagnostics state (non-sensitive summary) to clipboard/download.

### Usage tips
- Validator: keep defaults (limit/sample) to avoid heavy reads; it never writes.
- Playbook: suggestions use safe defaults (empty string/false/0) and “review” notes where needed.
- Bundle: capped trace/issues/actions; IDs and meta only, no payloads.

### Privacy
- No sensitive field values are logged; trace/meta sanitises to primitives.
- Bundle/trace are admin-only and in-memory unless copied/exported.
