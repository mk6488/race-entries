// Usage:
//   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json
//   node scripts/seed-blades.cjs

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

  const bladesPath = path.join(__dirname, '..', 'data', 'blades.json')
  const raw = fs.readFileSync(bladesPath, 'utf8')
  const blades = JSON.parse(raw)

  const batch = db.batch()
  const col = db.collection('blades')
  for (const blade of blades) {
    const ref = col.doc()
    batch.set(ref, {
      name: blade.name,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
  console.log(`Seeded ${blades.length} blades`)
}

main().catch((e) => { console.error(e); process.exit(1) })


