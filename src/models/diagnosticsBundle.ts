import type { TraceEvent } from '../utils/trace'
import type { ValidationIssue } from '../data/scanCollections'
import type { RepairAction } from './repair'

export type DiagnosticsBundle = {
  generatedAt: string
  app: { version: string; buildTime: string; env: 'dev' | 'prod' }
  auth: { uid?: string; isAnonymous?: boolean }
  route: { path: string }
  runtime?: { activeListeners?: number; activeKeys?: string[] }
  trace: { count: number; events: TraceEvent[] }
  validator?: { lastRunAt?: string; scanned?: number; issueCount?: number; issues?: ValidationIssue[] }
  playbook?: { generatedAt?: string; actionCount?: number; actions?: RepairAction[] }
}
