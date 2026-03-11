import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canUseMongo: vi.fn(),
  closeMongoClient: vi.fn(),
  getDebatesCollection: vi.fn(),
  getPersonasCollection: vi.fn(),
  getStocksCollection: vi.fn(),
  loadHomeStocksFromDb: vi.fn(),
  logApiEvent: vi.fn()
}));

vi.mock("@/lib/server/db", () => ({
  canUseMongo: mocks.canUseMongo,
  closeMongoClient: mocks.closeMongoClient,
  getDebatesCollection: mocks.getDebatesCollection,
  getPersonasCollection: mocks.getPersonasCollection,
  getStocksCollection: mocks.getStocksCollection
}));

vi.mock("@/lib/server/home-stocks", () => ({
  loadHomeStocksFromDb: mocks.loadHomeStocksFromDb
}));

vi.mock("@/lib/server/logging", () => ({
  logApiEvent: mocks.logApiEvent
}));

describe("database lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canUseMongo.mockReturnValue(true);

    const createIndex = vi.fn(async () => undefined);
    mocks.getStocksCollection.mockResolvedValue({ createIndex });
    mocks.getDebatesCollection.mockResolvedValue({ createIndex });
    mocks.getPersonasCollection.mockResolvedValue({ createIndex });

    delete (
      globalThis as typeof globalThis & {
        __dbLifecycleHooksRegistered?: boolean;
        __dbLifecycleInitPromise?: Promise<void>;
        __dbLifecycleShutdownPromise?: Promise<void>;
      }
    ).__dbLifecycleHooksRegistered;
    delete (
      globalThis as typeof globalThis & {
        __dbLifecycleInitPromise?: Promise<void>;
      }
    ).__dbLifecycleInitPromise;
    delete (
      globalThis as typeof globalThis & {
        __dbLifecycleShutdownPromise?: Promise<void>;
      }
    ).__dbLifecycleShutdownPromise;
  });

  it("initializes indexes without preloading tracked stocks", async () => {
    const { initializeDatabaseLifecycle } = await import("@/lib/server/database-lifecycle");

    await initializeDatabaseLifecycle();

    expect(mocks.getStocksCollection).toHaveBeenCalledTimes(1);
    expect(mocks.getDebatesCollection).toHaveBeenCalledTimes(1);
    expect(mocks.getPersonasCollection).toHaveBeenCalledTimes(1);
    expect(mocks.loadHomeStocksFromDb).not.toHaveBeenCalled();
    expect(mocks.logApiEvent).toHaveBeenCalledWith("db-lifecycle", "startup_begin");
    expect(mocks.logApiEvent).toHaveBeenCalledWith("db-lifecycle", "startup_complete", {
      collectionsReady: true
    });
  });
});
