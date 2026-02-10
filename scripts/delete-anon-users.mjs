#!/usr/bin/env node
/**
 * Delete ALL anonymous Firebase Auth users (providerData.length === 0).
 * - Requires env: FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS (service account JSON path).
 * - Read-only for Firestore; Auth-only deletes.
 * - Uses pagination + batched deletes (max 1000 per call).
 */

import fs from 'fs'
import path from 'path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const PAGE_SIZE = 1000
const DELETE_BATCH_SIZE = 1000

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

function isAnonymous(user) {
  return Array.isArray(user.providerData) && user.providerData.length === 0
}

async function main() {
  await ensureEnv()

  console.log('Initialising Firebase Admin (Auth cleanup)...')
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
  const auth = getAuth()

  let pageToken = undefined
  let scanned = 0
  let anonFound = 0
  let anonDeleted = 0
  let failures = 0

  do {
    const result = await auth.listUsers(PAGE_SIZE, pageToken)
    scanned += result.users.length

    const anonUids = result.users.filter(isAnonymous).map((u) => u.uid)
    anonFound += anonUids.length

    for (let i = 0; i < anonUids.length; i += DELETE_BATCH_SIZE) {
      const batch = anonUids.slice(i, i + DELETE_BATCH_SIZE)
      try {
        const res = await auth.deleteUsers(batch)
        anonDeleted += res.successCount
        failures += res.failureCount
        if (res.failureCount > 0) {
          res.errors.forEach((e) => {
            console.warn(`Delete failed for uid=${batch[e.index]}:`, e.error?.message || e.error)
          })
        }
      } catch (err) {
        failures += batch.length
        console.warn('Delete batch failed:', err)
      }
    }

    console.log(`Scanned: ${scanned}, anon found: ${anonFound}, anon deleted: ${anonDeleted}, failures: ${failures}`)
    pageToken = result.pageToken
  } while (pageToken)

  console.log('Done.')
  console.log(`Total scanned: ${scanned}`)
  console.log(`Anonymous users found: ${anonFound}`)
  console.log(`Anonymous users deleted: ${anonDeleted}`)
  console.log(`Delete failures: ${failures}`)
}

main().catch((err) => {
  console.error('Anon delete failed:', err)
  process.exit(1)
})
