"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DemoBanner } from "@/components/ui/demo-banner";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ARGUS route error", error);
  }, [error]);

  return (
    <div className="route-page page-stack">
      <DemoBanner />
      <section className="panel empty-state" role="alert">
        <div>
          <span className="badge badge-red">system exception</span>
          <h3>Operating picture temporarily unavailable</h3>
          <p>ARGUS preserved the current workspace. Retry the affected data surface or return to the Command Center.</p>
          <div className="toolbar" style={{ justifyContent: "center" }}>
            <button className="button button-primary" type="button" onClick={reset}>Retry connection</button>
            <Link className="button" href="/">Command Center</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
