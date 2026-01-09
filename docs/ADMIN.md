## Admin access for diagnostics

Diagnostics (`/diagnostics`) is admin-only. To grant access:
1) Find the user’s UID in Firebase Auth.
2) Create a Firestore doc: `/admins/{uid}` with:
```json
{ "enabled": true, "note": "optional" }
```

### Firestore rule (add manually in console/rules)
Allow a user to read only their own admin doc:
```
match /admins/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
}
```
Do not allow client writes; manage admin docs via Console.
