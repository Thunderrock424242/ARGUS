export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="ARGUS">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-orbit brand-orbit-one" />
        <span className="brand-orbit brand-orbit-two" />
        <span className="brand-core" />
      </span>
      {!compact && (
        <span className="brand-type">
          <strong>ARGUS</strong>
          <small>Global intelligence</small>
        </span>
      )}
    </span>
  );
}
