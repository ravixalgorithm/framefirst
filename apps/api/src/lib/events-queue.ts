import { Queue } from "bullmq";

import type { EventRow } from "@framefirst/types/events";

import { createRedisConnection } from "./redis.js";

export const eventsQueue = new Queue<EventRow, void, "collect">("events", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});
