import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Two projects:
//  • unit        — jsdom + fake-indexeddb, no network/DB. Runs anywhere.
//  • integration — Node + a throwaway local Postgres (spun up by test/global-db.ts).
//                  Exercises the real (businessId, localOrderId) unique constraint,
//                  so it needs Docker. It NEVER touches the shared Neon DB — the
//                  env override below points Prisma at localhost:5433.
const TEST_DB =
  "postgresql://postgres:test@localhost:5433/postgres?sslmode=disable";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.unit.test.ts"],
          setupFiles: ["./test/setup-indexeddb.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["./test/global-db.ts"],
          // One schema, shared across files — run them serially to keep counts sane.
          fileParallelism: false,
          env: {
            DATABASE_URL: TEST_DB,
            DIRECT_URL: TEST_DB,
          },
        },
      },
    ],
  },
});
