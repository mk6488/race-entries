export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="loading-state">
      <div className="spinner" aria-hidden="true" />
      <div>{label}</div>
    </div>
  )
}
