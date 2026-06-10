import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db, projects, users } from "@framefirst/db";
import type { ConversionGoal, Project } from "@framefirst/types/api";

import type { AuthUser } from "../types/fastify.js";

export type ProjectLookup = {
  id: string;
  snippetKey: string;
  allowedDomains: string[];
};

export type ProjectAnalyticsConfig = {
  id: string;
  userId: string;
  snippetKey: string;
  conversionGoal: ConversionGoal | null;
};

export function createSnippetKey(): string {
  return `ff_${randomBytes(16).toString("base64url")}`;
}

export async function ensureUser(user: AuthUser): Promise<void> {
  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        updatedAt: new Date()
      }
    });
}

export async function findProjectBySnippetKey(
  snippetKey: string
): Promise<ProjectLookup | null> {
  const [project] = await db
    .select({
      id: projects.id,
      snippetKey: projects.snippetKey,
      allowedDomains: projects.allowedDomains
    })
    .from(projects)
    .where(eq(projects.snippetKey, snippetKey))
    .limit(1);

  return project ?? null;
}

export async function findProjectAnalyticsConfig(
  snippetKey: string
): Promise<ProjectAnalyticsConfig | null> {
  const [project] = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      snippetKey: projects.snippetKey,
      conversionGoal: projects.conversionGoal
    })
    .from(projects)
    .where(eq(projects.snippetKey, snippetKey))
    .limit(1);

  return project ?? null;
}

export async function userOwnsSnippetKey(
  userId: string,
  snippetKey: string
): Promise<boolean> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.snippetKey, snippetKey)))
    .limit(1);

  return Boolean(project);
}

export async function projectForSnippetKey(
  userId: string,
  snippetKey: string
): Promise<typeof projects.$inferSelect | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.snippetKey, snippetKey)))
    .limit(1);

  return project ?? null;
}

export function toProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    siteUrl: row.siteUrl,
    snippetKey: row.snippetKey,
    allowedDomains: row.allowedDomains,
    conversionGoal: row.conversionGoal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function domainsFromSiteUrl(siteUrl: string | undefined): string[] {
  if (!siteUrl) {
    return [];
  }

  try {
    return [new URL(siteUrl).hostname.toLowerCase()];
  } catch {
    return [];
  }
}
