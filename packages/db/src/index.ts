import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

config({ path: "../../.env" });
config({ path: "../../.env.local", override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const sql = postgres(databaseUrl, {
  max: 10,
  prepare: false
});

export const db = drizzle(sql, { schema });

export * from "./schema.js";
export * from "./clickhouse.js";
