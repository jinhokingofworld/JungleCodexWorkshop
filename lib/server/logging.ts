type ApiLogLevel = "info" | "warn" | "error";

export function logApiEvent(
  scope: string,
  event: string,
  details?: Record<string, unknown>,
  level: ApiLogLevel = "info"
) {
  const payload = details ? JSON.stringify(details) : "";
  const message = payload ? `[api:${scope}] ${event} ${payload}` : `[api:${scope}] ${event}`;

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}
