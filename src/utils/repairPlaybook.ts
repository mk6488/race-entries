import type { ValidationIssue } from '../data/scanCollections'
import type { RepairAction, RepairPlaybook } from '../models/repair'
import { trace } from './trace'

const safeDefault = (_field: string): string | number | boolean | object | null => {
  return ''
}

export function generateRepairPlaybook(issues: ValidationIssue[]): RepairPlaybook {
  const actionsMap = new Map<string, RepairAction>()

  for (const issue of issues) {
    const key = `${issue.collection}:${issue.docId}:${issue.field || 'unknown'}`
    if (actionsMap.has(key)) continue

    const action = issueToAction(issue)
    if (action) actionsMap.set(key, action)
  }

  const actions = Array.from(actionsMap.values())
  trace({ type: 'validator:playbook', meta: { actions: actions.length } })
  return {
    generatedAt: new Date().toISOString(),
    actions,
  }
}

function issueToAction(issue: ValidationIssue): RepairAction | null {
  if (!issue.field) return null
  const base = { collection: issue.collection, docId: issue.docId, field: issue.field }
  const msg = issue.message.toLowerCase()

  if (msg.includes('missing') || msg.includes('required')) {
    return {
      ...base,
      action: 'set',
      suggestedValue: safeDefault(issue.field),
      note: 'Missing required field; set safe default (review)',
    }
  }

  if (msg.includes('fallback') || msg.includes('type')) {
    return {
      ...base,
      action: 'convert',
      suggestedValue: safeDefault(issue.field),
      note: 'Type mismatch; consider converting or setting safe default (review)',
    }
  }

  return {
    ...base,
    action: 'set',
    suggestedValue: safeDefault(issue.field),
    note: 'Review manually; safe default suggested',
  }
}

export function toMarkdown(playbook: RepairPlaybook): string {
  if (!playbook.actions.length) return 'No repairs suggested.'
  const lines = [
    `# Repair Playbook`,
    `Generated: ${playbook.generatedAt}`,
    '',
    ...playbook.actions.map(
      (a) =>
        `- **${a.collection}/${a.docId}** \`${a.field}\` — ${a.action.toUpperCase()} ${a.suggestedValue !== undefined ? '`' + JSON.stringify(a.suggestedValue) + '`' : ''
        } ${a.note ? `(${a.note})` : ''}`,
    ),
  ]
  return lines.join('\n')
}

export function toJson(playbook: RepairPlaybook): string {
  return JSON.stringify(playbook, null, 2)
}
