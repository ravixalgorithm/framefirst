import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, sql } from "./index.js";

config({ path: "../../.env" });
config({ path: "../../.env.local", override: true });

await migrate(db, { migrationsFolder: "drizzle" });
await sql.end();

console.log("Migrations complete");
