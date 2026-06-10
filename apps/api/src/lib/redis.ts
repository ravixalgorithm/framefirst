import { Redis } from "ioredis";

import { env } from "../config.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null
});

export function createRedisConnection(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null
  });
}
