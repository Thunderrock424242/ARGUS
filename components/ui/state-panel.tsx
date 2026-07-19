import { AlertTriangle, Database, LockKeyhole, RadioTower, SearchX, WifiOff } from "lucide-react";
import Link from "next/link";

const icons = {
  empty: SearchX,
  offline: WifiOff,
  source: RadioTower,
  database: Database,
  permission: LockKeyhole,
  error: AlertTriangle,
};

export function StatePanel({
  type = "empty",
  title,
  description,
  actionHref,
  actionLabel,
}: {
  type?: keyof typeof icons;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const Icon = icons[type];
  return (
    <section className="panel empty-state" role={type === "error" ? "alert" : "status"}>
      <div>
        <Icon size={29} aria-hidden="true" />
        <h3>{title}</h3>
        <p>{description}</p>
        {actionHref && actionLabel ? <Link href={actionHref} className="button button-primary">{actionLabel}</Link> : null}
      </div>
    </section>
  );
}
