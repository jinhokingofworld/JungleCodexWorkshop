import type { GuardMode } from "@/lib/types";

export const guardMode = (process.env.GUARD_MODE ?? "off") as GuardMode;

export const appConfig = {
  guardMode,
  llmProvider: process.env.LLM_PROVIDER ?? "mock",
  llmModel: process.env.LLM_MODEL ?? "mock-debate-v1",
  appName: "Signal Room",
  streamDelayMs: 2200
};

export function isGuardOff() {
  return appConfig.guardMode === "off";
}
