import { Worker } from "bullmq";

import { insertEvent } from "@framefirst/db/clickhouse";
import type { EventRow } from "@framefirst/types/events";

import { createRedisConnection } from "../lib/redis.js";

const worker = new Worker<EventRow, void, "collect">(
  "events",
  async (job) => {
    await insertEvent(job.data);
  },
  {
    connection: createRedisConnection(),
    concurrency: 10
  }
);

worker.on("completed", (job) => {
  console.log(`Event job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Event job ${job?.id ?? "unknown"} failed`, error);
});

console.log("Frame First events worker running");
