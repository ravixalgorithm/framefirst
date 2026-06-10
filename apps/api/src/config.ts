import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local"), override: true });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  apiPort: Number(process.env.API_PORT ?? "3001"),
  publicApiUrl: process.env.PUBLIC_API_URL ?? "http://localhost:3001",
  trackJsCdnUrl: process.env.TRACK_JS_CDN_URL ?? "http://localhost:3001/track.js",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "supersecretlocaldevkey_dontuseinprod",
  onesignalAppId: process.env.ONESIGNAL_APP_ID ?? "",
  onesignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY ?? ""
} as const;

export function requireEnv(value: string, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
