import { execFileSync, spawnSync } from "node:child_process";

// Provisions a disposable Postgres for the integration project, applies the full
// Prisma schema to it, and destroys it afterwards. Isolated by design: nothing
// here reads DATABASE_URL from .env, so the shared Neon DB is never touched.
const CONTAINER = "servrail-pos-testdb";
const PORT = "5433";
const TEST_DB = `postgresql://postgres:test@localhost:${PORT}/postgres?sslmode=disable`;

function docker(args: string[]) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres() {
  for (let i = 0; i < 60; i++) {
    const r = docker(["exec", CONTAINER, "pg_isready", "-U", "postgres", "-d", "postgres"]);
    if (r.status === 0) return;
    await sleep(1000);
  }
  throw new Error("Test Postgres did not become ready within 60s");
}

export async function setup() {
  if (docker(["version"]).status !== 0) {
    throw new Error(
      "Integration tests need Docker, but `docker` is unavailable. " +
        "Run the unit project instead: npm run test:unit",
    );
  }

  // Remove any container left over from a crashed run, then start fresh.
  docker(["rm", "-f", CONTAINER]);
  const run = docker([
    "run", "-d", "--name", CONTAINER,
    "-e", "POSTGRES_PASSWORD=test",
    "-e", "POSTGRES_DB=postgres",
    "-p", `${PORT}:5432`,
    "postgres:16-alpine",
  ]);
  if (run.status !== 0) {
    throw new Error(`Failed to start test Postgres:\n${run.stderr || run.stdout}`);
  }

  await waitForPostgres();

  // db push (not migrate) builds the whole schema into the empty throwaway DB —
  // the "never migrate the shared DB" rule is about Neon, not this container.
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DB, DIRECT_URL: TEST_DB },
  });
}

export async function teardown() {
  docker(["rm", "-f", CONTAINER]);
}
