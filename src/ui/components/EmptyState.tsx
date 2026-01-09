type Props = {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      {description ? <div className="empty-description">{description}</div> : null}
      {action ? (
        <button className="primary-btn" onClick={action.onClick} style={{ marginTop: 8 }}>
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
