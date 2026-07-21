import { DatabaseZap } from "lucide-react";
import Link from "@/components/navigation/link";

export function DemoDisabled({ feature }: { feature: string }) {
  return (
    <main className="route-page page-stack p-4 sm:p-6 xl:p-8">
      <section className="mx-auto mt-16 max-w-2xl rounded-xl border border-cyan-300/15 bg-[#0a1219] p-8 text-center">
        <DatabaseZap className="mx-auto text-cyan-300" size={30} />
        <h1 className="mt-5 text-xl font-semibold text-slate-100">{feature} has no live records yet</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Demonstration data is disabled. This screen will remain empty until its live D1 data source is populated.
        </p>
        <Link className="button button-primary mt-6" href="/ingestion">Open ingestion</Link>
      </section>
    </main>
  );
}
