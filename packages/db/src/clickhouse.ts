import { createClient } from "@clickhouse/client";
import { config } from "dotenv";

import type { EventRow } from "@framefirst/types/events";

config({ path: "../../.env" });
config({ path: "../../.env.local", override: true });

export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_HOST ?? "http://localhost:8123",
  database: process.env.CLICKHOUSE_DB ?? "framefirst",
  username: process.env.CLICKHOUSE_USER ?? "default",
  password: process.env.CLICKHOUSE_PASSWORD ?? ""
});

export const eventsTableDdl = `
CREATE TABLE IF NOT EXISTS events (
  site_id          String,
  session_id       String,
  anonymous_id     String,
  event_type       Enum8('pageview'=1,'click'=2,'custom'=3,'formsubmit'=4),
  url              String,
  referrer         String,
  utm_source       String,
  utm_medium       String,
  utm_campaign     String,
  utm_term         String,
  utm_content      String,
  x_pct            Float32,
  y_pct            Float32,
  element_selector String,
  variant_id       String,
  country          String,
  device           String,
  timestamp        DateTime
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, timestamp)
TTL timestamp + INTERVAL 2 YEAR
`;

export async function ensureEventsTable(): Promise<void> {
  await clickhouse.command({ query: eventsTableDdl });
}

export async function insertEvent(event: EventRow): Promise<void> {
  await ensureEventsTable();
  await clickhouse.insert({
    table: "events",
    values: [normalizeEvent(event)],
    format: "JSONEachRow"
  });
}

export type ClickHouseQueryParams = Record<string, string | number | boolean>;

export async function queryEvents<T>(
  query: string,
  queryParams?: ClickHouseQueryParams
): Promise<T[]> {
  const resultSet = await clickhouse.query(
    queryParams
      ? {
          query,
          format: "JSONEachRow",
          query_params: queryParams
        }
      : {
          query,
          format: "JSONEachRow"
        }
  );

  return resultSet.json<T>();
}

function normalizeEvent(event: EventRow): EventRow {
  return {
    ...event,
    timestamp: toClickHouseDateTime(event.timestamp)
  };
}

function toClickHouseDateTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return toClickHouseDateTime(new Date().toISOString());
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}
