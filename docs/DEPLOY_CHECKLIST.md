## Deploy Checklist

### Pre-deploy
- Run `npm run typecheck`
- Run `npm run lint`
- Run `npm run build`
- Quick smoke:
  - Load home and open a race
  - Open entries page for a race
  - Open diagnostics (`/diagnostics`) to confirm it loads

### Deploy
- Ensure CI is green
- Deploy to production (main)
- Verify `/diagnostics` shows the expected version/hash and build time

### Post-deploy
- Quick core flows:
  - Add or edit an entry
  - Print view still looks clean
  - Equipment pages load
- Note any anomalies in diagnostics
