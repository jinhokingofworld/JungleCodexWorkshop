import type { GuardDecision, GuardMode } from "@/lib/types";
import { appConfig } from "@/lib/server/config";

function getIpKey(ip: string | null) {
  return ip ?? "unknown";
}

const globalCounters = globalThis as typeof globalThis & {
  __guardCounters?: Map<string, { count: number; windowStart: number }>;
};

function getCounterStore() {
  if (!globalCounters.__guardCounters) {
    globalCounters.__guardCounters = new Map();
  }

  return globalCounters.__guardCounters;
}

export function evaluateGuard(ip: string | null): GuardDecision {
  const mode = appConfig.guardMode;
  if (mode === "off") {
    return { allowed: true, mode };
  }

  const key = getIpKey(ip);
  const store = getCounterStore();
  const now = Date.now();
  const current = store.get(key);

  if (!current || now - current.windowStart > 10 * 60_000) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, mode };
  }

  current.count += 1;
  store.set(key, current);

  if (mode === "monitor") {
    return { allowed: true, mode, reason: `monitor:${current.count}` };
  }

  if (mode === "enforce" && current.count > 5) {
    return { allowed: false, mode, reason: "Too many analysis requests" };
  }

  return { allowed: true, mode };
}

export function recordGuardEvent(ip: string | null, mode: GuardMode, reason?: string) {
  if (mode === "off") {
    return;
  }

  console.info("[guard]", {
    ip: getIpKey(ip),
    mode,
    reason: reason ?? "ok"
  });
}
