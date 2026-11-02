import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

/**
 * Creates a fresh database, applies the Supabase stub, all migrations and the
 * demo seed. Requires a reachable Postgres ≥ 15 (DATABASE_URL, default
 * postgres://postgres@localhost:54329/postgres via socket in CI scripts).
 */
export const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://postgres@%2Fvar%2Ftmp:54329/postgres";
export const DB_NAME = "campusnav_rls_test";

export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${DB_NAME} with (force)`);
  await admin.query(`create database ${DB_NAME}`);
  await admin.end();

  const db = new pg.Client({ connectionString: ADMIN_URL.replace(/\/postgres$/, `/${DB_NAME}`) });
  await db.connect();
  const root = resolve(import.meta.dirname, "..");
  const files = [
    resolve(import.meta.dirname, "sql/00_supabase_stub.sql"),
    ...readdirSync(resolve(root, "migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => resolve(root, "migrations", f)),
    resolve(root, "seed.sql"),
  ];
  for (const f of files) await db.query(readFileSync(f, "utf8"));
  await db.end();
}
