## Admin gating for /diagnostics

To access `/diagnostics` you must have a document under `admins/{uid}` with:

```json
{ "enabled": true, "note": "optional" }
```

### Suggested Firestore rule (add manually in console/rules)
Allow users to read their own admin doc only:
```
match /admins/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
}
```

Do not allow writes from clients; manage admin docs via the Firebase Console.
