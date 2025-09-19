// Usage:
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json
//   node scripts/seed-boats.cjs

const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

function requireEnv() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Point it to your Firebase service account JSON.')
    process.exit(1)
  }
}

async function main() {
  requireEnv()
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
  }
  const db = admin.firestore()

  const boatsPath = path.join(__dirname, '..', 'data', 'boats.json')
  const raw = fs.readFileSync(boatsPath, 'utf8')
  const boats = JSON.parse(raw)

  const batch = db.batch()
  const col = db.collection('boats')
  for (const boat of boats) {
    const ref = col.doc() // let Firestore assign id
    batch.set(ref, {
      type: boat.type,
      name: boat.name,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
  console.log(`Seeded ${boats.length} boats`)
}

main().catch((e) => { console.error(e); process.exit(1) })


