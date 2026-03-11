import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
import { MongoClient, ServerApiVersion } from "mongodb";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const mode = process.argv[2] ?? "dev";
const nextArgs = process.argv.slice(3);
const { loadEnvConfig } = nextEnv;

function logApiEvent(scope, event, details = undefined, level = "info") {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  const message = `[api:${scope}] ${event}${payload}`;

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

async function ensureDatabaseCollections() {
  loadEnvConfig(process.cwd(), mode === "dev");

  if (!process.env.MONGODB_URI) {
    logApiEvent("db-lifecycle", "startup_skipped", { reason: "missing_mongodb_uri" }, "warn");
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: ServerApiVersion.v1
  });

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME ?? "week2");
    const stocks = db.collection("stocks");
    const debates = db.collection("debates");
    const personas = db.collection("personas");

    logApiEvent("db-lifecycle", "startup_begin");

    await Promise.all([
      stocks.createIndex({ nation: 1, ticker: 1 }, { unique: true, name: "stocks_nation_ticker" }),
      stocks.createIndex({ create_at: -1 }, { name: "stocks_create_at" }),
      debates.createIndex(
        { stock_code: 1, create_at: -1 },
        { name: "debates_stock_code_create_at" }
      ),
      personas.createIndex({ name: 1 }, { unique: true, name: "personas_name" })
    ]);

    logApiEvent("db-lifecycle", "startup_complete", {
      collectionsReady: true
    });
  } finally {
    await client.close();
  }
}

function exitCodeFromSignal(signal) {
  if (signal === "SIGINT") {
    return 130;
  }

  if (signal === "SIGTERM") {
    return 143;
  }

  return 0;
}

async function main() {
  try {
    await ensureDatabaseCollections();
  } catch (error) {
    logApiEvent(
      "db-lifecycle",
      "startup_error",
      { message: error instanceof Error ? error.message : "unknown_error" },
      "error"
    );
  }

  const child = spawn(process.execPath, [nextBin, mode, ...nextArgs], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  let shutdownReason = null;

  const forwardSignal = (signal) => {
    shutdownReason = signal;
    logApiEvent("db-lifecycle", "shutdown_begin", { reason: signal });
    child.kill(signal);
    logApiEvent("db-lifecycle", "shutdown_complete", { reason: signal });
  };

  process.once("SIGINT", () => {
    forwardSignal("SIGINT");
  });

  process.once("SIGTERM", () => {
    forwardSignal("SIGTERM");
  });

  child.once("exit", (code, signal) => {
    const reason = shutdownReason ?? signal ?? `exit_${code ?? 0}`;
    if (!shutdownReason) {
      logApiEvent("db-lifecycle", "shutdown_complete", { reason });
    }
    process.exit(code ?? exitCodeFromSignal(signal));
  });
}

await main();
