import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../firebase'
import { toErrorMessage } from '../utils/errors'
import { trace } from '../utils/trace'
import { toEntry } from './entries'
import { toRace } from './races'
import { toBoat } from './boats'
import { toBlade } from './blades'
import { toModel as toDivisionGroup } from './divisionGroups'
import { toModel as toSilence } from './silences'
import { toModel as toBladeSilence } from './silencedBlades'

export type ValidationIssue = { collection: string; docId: string; level: 'warn' | 'error'; message: string; field?: string }
export type ValidationResult = { scanned: number; issues: ValidationIssue[]; lastRunAt?: string }

type ScanOptions = {
  limitPerCollection?: number
  maxIssues?: number
  collections?: string[]
}

type IssueCtx = { issues: ValidationIssue[]; collection: string; docId: string; maxIssues: number }

function addIssue(ctx: IssueCtx, level: 'warn' | 'error', message: string, field?: string) {
  if (ctx.issues.length >= ctx.maxIssues) return
  ctx.issues.push({ collection: ctx.collection, docId: ctx.docId, level, message, field })
}

export async function runValidation(opts: ScanOptions = {}): Promise<ValidationResult> {
  const { limitPerCollection = 50, maxIssues = 100, collections } = opts
  const issues: ValidationIssue[] = []
  let scanned = 0

  const targets: string[] = collections && collections.length ? collections : ['races', 'entries', 'boats', 'blades', 'divisionGroups', 'silencedClashes', 'silencedBladeClashes']

  for (const colName of targets) {
    try {
      const colRef = collection(db, colName)
      const snap = await getDocs(query(colRef, limit(limitPerCollection)))
      snap.forEach((doc) => {
        if (issues.length >= maxIssues) return
        scanned += 1
        const ctx: IssueCtx = { issues, collection: colName, docId: doc.id, maxIssues }
        const raw = doc.data()
        try {
          switch (colName) {
            case 'races':
              toRace(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'entries':
              toEntry(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'boats':
              toBoat(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'blades':
              toBlade(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'divisionGroups':
              toDivisionGroup(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'silencedClashes':
              toSilence(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            case 'silencedBladeClashes':
              toBladeSilence(doc.id, raw, { issues, collection: colName, docId: doc.id })
              break
            default:
              addIssue(ctx, 'warn', 'Unsupported collection')
          }
        } catch (err) {
          addIssue(ctx, 'error', toErrorMessage(err))
        }
      })
    } catch (err) {
      issues.push({ collection: colName, docId: '-', level: 'error', message: toErrorMessage(err) })
      trace({ type: 'error', scope: 'validator', meta: { collection: colName, message: toErrorMessage(err) } })
    }
    if (issues.length >= maxIssues) break
  }

  return { scanned, issues, lastRunAt: new Date().toISOString() }
}
