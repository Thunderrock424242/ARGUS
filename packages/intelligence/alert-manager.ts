import type { AlertPriority, IntelligenceAlert } from "@/packages/shared/types";

const PRIORITY_WEIGHT: Record<AlertPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

export interface AlertManagerOptions {
  now?: () => number;
  maximumHistory?: number;
}

export interface AlertEnqueueResult {
  accepted: boolean;
  reason?: "duplicate" | "cooldown";
  alert: IntelligenceAlert;
}

export class AlertManager {
  private readonly queued: IntelligenceAlert[] = [];
  private readonly history: IntelligenceAlert[] = [];
  private readonly lastAcceptedByKey = new Map<string, number>();
  private active: IntelligenceAlert | null = null;
  private readonly now: () => number;
  private readonly maximumHistory: number;

  constructor(options: AlertManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maximumHistory = options.maximumHistory ?? 200;
  }

  enqueue(alert: IntelligenceAlert): AlertEnqueueResult {
    const duplicate = this.active?.deduplicationKey === alert.deduplicationKey ||
      this.queued.some((candidate) => candidate.deduplicationKey === alert.deduplicationKey);
    if (duplicate) return { accepted: false, reason: "duplicate", alert };
    const lastAccepted = this.lastAcceptedByKey.get(alert.deduplicationKey);
    if (lastAccepted !== undefined && this.now() - lastAccepted < alert.cooldownSeconds * 1_000) {
      return { accepted: false, reason: "cooldown", alert };
    }
    this.lastAcceptedByKey.set(alert.deduplicationKey, this.now());
    this.queued.push({ ...alert, state: "queued" });
    this.queued.sort((left, right) =>
      PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] || left.createdAt.localeCompare(right.createdAt),
    );
    return { accepted: true, alert };
  }

  next(): IntelligenceAlert | null {
    if (this.active) return this.active;
    const next = this.queued.shift();
    if (!next) return null;
    this.active = { ...next, state: "active" };
    return this.active;
  }

  acknowledge(id: string, occurredAt = new Date(this.now()).toISOString()): IntelligenceAlert | null {
    if (!this.active || this.active.id !== id) return null;
    const acknowledged: IntelligenceAlert = { ...this.active, state: "acknowledged", acknowledgedAt: occurredAt };
    this.record(acknowledged);
    this.active = null;
    return acknowledged;
  }

  dismiss(id: string, occurredAt = new Date(this.now()).toISOString()): IntelligenceAlert | null {
    if (this.active?.id === id) {
      const dismissed: IntelligenceAlert = { ...this.active, state: "dismissed", dismissedAt: occurredAt };
      this.record(dismissed);
      this.active = null;
      return dismissed;
    }
    const queuedIndex = this.queued.findIndex((alert) => alert.id === id);
    if (queuedIndex < 0) return null;
    const [queued] = this.queued.splice(queuedIndex, 1);
    const dismissed: IntelligenceAlert = { ...queued, state: "dismissed", dismissedAt: occurredAt };
    this.record(dismissed);
    return dismissed;
  }

  cancelAll(): void {
    if (this.active) this.record({ ...this.active, state: "expired" });
    for (const alert of this.queued) this.record({ ...alert, state: "expired" });
    this.active = null;
    this.queued.length = 0;
  }

  snapshot(): { active: IntelligenceAlert | null; queued: IntelligenceAlert[]; history: IntelligenceAlert[] } {
    return {
      active: this.active ? structuredClone(this.active) : null,
      queued: structuredClone(this.queued),
      history: structuredClone(this.history),
    };
  }

  private record(alert: IntelligenceAlert): void {
    this.history.unshift(alert);
    if (this.history.length > this.maximumHistory) this.history.length = this.maximumHistory;
  }
}
