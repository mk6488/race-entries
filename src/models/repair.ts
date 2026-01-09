export type RepairAction = {
  collection: string
  docId: string
  field: string
  action: 'set' | 'delete' | 'convert'
  suggestedValue?: string | number | boolean | object | null
  note?: string
}

export type RepairPlaybook = {
  generatedAt: string
  actions: RepairAction[]
}
