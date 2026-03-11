import {
  canUseMongo,
  closeMongoClient,
  getDebatesCollection,
  getPersonasCollection,
  getStocksCollection
} from "@/lib/server/db";
import { logApiEvent } from "@/lib/server/logging";

const globalLifecycle = globalThis as typeof globalThis & {
  __dbLifecycleInitPromise?: Promise<void>;
  __dbLifecycleShutdownPromise?: Promise<void>;
  __dbLifecycleHooksRegistered?: boolean;
};

async function ensureDatabaseCollections() {
  const stocks = await getStocksCollection();
  const debates = await getDebatesCollection();
  const personas = await getPersonasCollection();

  await Promise.all([
    stocks.createIndex({ nation: 1, ticker: 1 }, { unique: true, name: "stocks_nation_ticker" }),
    stocks.createIndex({ create_at: -1 }, { name: "stocks_create_at" }),
    debates.createIndex(
      { stock_code: 1, create_at: -1 },
      { name: "debates_stock_code_create_at" }
    ),
    personas.createIndex({ name: 1 }, { unique: true, name: "personas_name" })
  ]);
}

export async function initializeDatabaseLifecycle() {
  if (!canUseMongo()) {
    return;
  }

  if (globalLifecycle.__dbLifecycleInitPromise) {
    return globalLifecycle.__dbLifecycleInitPromise;
  }

  globalLifecycle.__dbLifecycleInitPromise = (async () => {
    logApiEvent("db-lifecycle", "startup_begin");
    await ensureDatabaseCollections();
    logApiEvent("db-lifecycle", "startup_complete", {
      collectionsReady: true
    });
  })().catch((error) => {
    delete globalLifecycle.__dbLifecycleInitPromise;
    logApiEvent(
      "db-lifecycle",
      "startup_error",
      { message: error instanceof Error ? error.message : "unknown_error" },
      "error"
    );
    throw error;
  });

  return globalLifecycle.__dbLifecycleInitPromise;
}

export async function shutdownDatabaseLifecycle(reason: string) {
  if (!canUseMongo()) {
    return;
  }

  if (globalLifecycle.__dbLifecycleShutdownPromise) {
    return globalLifecycle.__dbLifecycleShutdownPromise;
  }

  globalLifecycle.__dbLifecycleShutdownPromise = (async () => {
    logApiEvent("db-lifecycle", "shutdown_begin", { reason });
    await closeMongoClient();
    logApiEvent("db-lifecycle", "shutdown_complete", { reason });
  })().finally(() => {
    delete globalLifecycle.__dbLifecycleShutdownPromise;
  });

  return globalLifecycle.__dbLifecycleShutdownPromise;
}

function bindSignal(signal: NodeJS.Signals) {
  const handler = () => {
    void shutdownDatabaseLifecycle(signal).finally(() => {
      process.removeListener(signal, handler);
      process.kill(process.pid, signal);
    });
  };

  process.once(signal, handler);
}

function registerShutdownHooks() {
  if (globalLifecycle.__dbLifecycleHooksRegistered) {
    return;
  }

  globalLifecycle.__dbLifecycleHooksRegistered = true;
  bindSignal("SIGINT");
  bindSignal("SIGTERM");
  process.once("beforeExit", () => {
    void shutdownDatabaseLifecycle("beforeExit");
  });
}

export async function registerDatabaseLifecycle() {
  registerShutdownHooks();
  await initializeDatabaseLifecycle();
}
