export default function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div style={{ paddingRight: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {description && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{description}</div>}
      </div>
      <label className="switch">
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="slider" />
      </label>
    </div>
  );
}
