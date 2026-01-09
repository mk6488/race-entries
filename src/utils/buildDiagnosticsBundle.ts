import { buildInfo } from './buildInfo'
import { getTrace, TraceEvent } from './trace'
import type { DiagnosticsBundle } from '../models/diagnosticsBundle'
import type { ValidationResult } from '../data/scanCollections'
import type { RepairPlaybook } from '../models/repair'
import { trace } from './trace'

type Params = {
  auth: { uid?: string; isAnonymous?: boolean }
  routePath: string
  subs?: { active: number; keys: string[] }
  validator?: ValidationResult | null
  playbook?: RepairPlaybook | null
  limits?: { trace?: number; issues?: number; actions?: number }
}

const defaultLimits = { trace: 50, issues: 100, actions: 100 }

function safeTrace(events: TraceEvent[], max: number) {
  return events
    .slice(-max)
    .map((e) => ({
      ...e,
      meta: sanitizeMeta(e.meta),
    }))
}

function sanitizeMeta(meta: unknown): Record<string, string | number | boolean> | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return Object.keys(out).length ? out : undefined
}

export function buildDiagnosticsBundle(params: Params): DiagnosticsBundle {
  try {
    const limits = { ...defaultLimits, ...(params.limits || {}) }
    const traceEvents = safeTrace(getTrace(), limits.trace ?? defaultLimits.trace)

    const validatorIssues = params.validator?.issues
      ? params.validator.issues.slice(0, limits.issues ?? defaultLimits.issues)
      : undefined

    const playbookActions = params.playbook?.actions
      ? params.playbook.actions.slice(0, limits.actions ?? defaultLimits.actions)
      : undefined

    const bundle: DiagnosticsBundle = {
      generatedAt: new Date().toISOString(),
      app: { version: buildInfo.version, buildTime: buildInfo.buildTime, env: import.meta.env.DEV ? 'dev' : 'prod' },
      auth: { uid: params.auth.uid, isAnonymous: params.auth.isAnonymous },
      route: { path: params.routePath },
      runtime: params.subs ? { activeListeners: params.subs.active, activeKeys: params.subs.keys } : undefined,
      trace: { count: traceEvents.length, events: traceEvents },
      validator: params.validator
        ? {
            lastRunAt: params.validator.lastRunAt || undefined,
            scanned: params.validator.scanned,
            issueCount: params.validator.issues.length,
            issues: validatorIssues,
          }
        : undefined,
      playbook: params.playbook
        ? {
            generatedAt: params.playbook.generatedAt,
            actionCount: params.playbook.actions.length,
            actions: playbookActions,
          }
        : undefined,
    }

    trace({ type: 'diag:bundle', meta: { trace: bundle.trace.count, issues: validatorIssues?.length || 0, actions: playbookActions?.length || 0 } })
    return bundle
  } catch (err) {
    trace({ type: 'error', scope: 'diag:bundle', meta: { message: (err as Error)?.message } })
    return {
      generatedAt: new Date().toISOString(),
      app: { version: buildInfo.version, buildTime: buildInfo.buildTime, env: import.meta.env.DEV ? 'dev' : 'prod' },
      auth: { uid: params.auth.uid, isAnonymous: params.auth.isAnonymous },
      route: { path: params.routePath },
      trace: { count: 0, events: [] },
    }
  }
}
