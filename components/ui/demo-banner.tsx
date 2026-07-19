import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <Info size={14} aria-hidden="true" />
      <strong>Demonstration data — not real-world intelligence.</strong>
      <span>All events, reports, assessments, and source activity shown in this build are fictional.</span>
    </div>
  );
}
