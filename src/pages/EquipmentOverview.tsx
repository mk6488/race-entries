export function EquipmentOverview() {
  return (
    <div>
      <div className="card" style={{ marginTop: 4 }}>
        <h1 style={{ margin: 0 }}>Equipment</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <a className="secondary-btn" href="/equipment/boats">Manage boats</a>
          <a className="secondary-btn" href="/equipment/blades">Manage blades</a>
        </div>
      </div>
    </div>
  )
}


