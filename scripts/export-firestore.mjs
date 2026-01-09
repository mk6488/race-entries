#!/usr/bin/env node
/**
 * Firestore JSON export (read-only).
 * - Requires env: FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS (service account JSON path).
 * - Outputs JSON per collection under <out>/<timestamp>/.
 * - Collections default: races,entries,boats,blades,divisionGroups,gearing,silencedClashes,silencedBladeClashes
 * - Optional: --out <dir> (default: backups), --limit <n>, --collections a,b,c
 * Keep outputs secure; they may contain sensitive data.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { setTimeout as wait } from 'timers/promises'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, limit as fbLimit } from 'firebase-admin/firestore'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_COLLECTIONS = [
  'races',
  'entries',
  'boats',
  'blades',
  'divisionGroups',
  'gearing',
  'silencedClashes',
  'silencedBladeClashes',
]

function parseArgs() {
  const args = process.argv.slice(2)
  const options = { out: 'backups', collections: DEFAULT_COLLECTIONS, limit: undefined }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--out' && args[i + 1]) {
      options.out = args[++i]
    } else if (arg === '--collections' && args[i + 1]) {
      options.collections = args[++i]
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    } else if (arg === '--limit' && args[i + 1]) {
      const n = Number(args[++i])
      if (Number.isFinite(n) && n > 0) options.limit = n
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }
  return options
}

function printHelp() {
  console.log(`Usage: node scripts/export-firestore.mjs [--out backups] [--limit 500] [--collections a,b]

Env required:
  FIREBASE_PROJECT_ID
  GOOGLE_APPLICATION_CREDENTIALS (service account JSON path)

Notes:
  - Read-only export; writes JSON locally.
  - Keep outputs secure; may contain sensitive data.`)
}

async function ensureEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!projectId || !creds) {
    console.error('Missing FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS. Refusing to run.')
    process.exit(1)
  }
  try {
    await fs.promises.access(path.resolve(creds), fs.constants.R_OK)
  } catch (err) {
    console.error(`Cannot read GOOGLE_APPLICATION_CREDENTIALS file: ${creds}`)
    console.error(err)
    process.exit(1)
  }
  return { projectId }
}

async function main() {
  const options = parseArgs()
  await ensureEnv()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const targetRoot = path.resolve(options.out, timestamp)
  await fs.promises.mkdir(targetRoot, { recursive: true })

  console.log('Initialising Firebase Admin (read-only export)...')
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
  const db = getFirestore()

  console.warn('Reminder: exports may contain sensitive data. Store outputs securely.')

  for (const colName of options.collections) {
    console.log(`Exporting collection: ${colName}`)
    const colRef = db.collection(colName)
    const query = typeof options.limit === 'number' ? colRef.limit(options.limit) : colRef
    const snap = await query.get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const filePath = path.join(targetRoot, `${colName}.json`)
    await fs.promises.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf8')
    console.log(`  -> ${rows.length} docs -> ${path.relative(process.cwd(), filePath)}`)
    // Small delay to avoid overwhelming local FS
    await wait(50)
  }

  console.log('Export complete.')
}

main().catch((err) => {
  console.error('Export failed:', err)
  process.exit(1)
})
