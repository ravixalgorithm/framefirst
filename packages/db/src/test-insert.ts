import { randomUUID } from "node:crypto";

import { insertEvent, queryEvents } from "./clickhouse.js";

const siteId = `test-${randomUUID()}`;

await insertEvent({
  site_id: siteId,
  session_id: randomUUID(),
  anonymous_id: randomUUID(),
  event_type: "pageview",
  url: "https://example.com",
  referrer: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  x_pct: 0,
  y_pct: 0,
  element_selector: "",
  variant_id: "",
  country: "",
  device: "test",
  timestamp: new Date().toISOString()
});

const rows = await queryEvents<{ site_id: string; event_type: string }>(
  `SELECT site_id, event_type FROM events WHERE site_id = '${siteId}' LIMIT 1`
);

console.log(rows);
