export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" role="status" aria-label={label} />
      {label && <div>{label}</div>}
    </div>
  );
}
