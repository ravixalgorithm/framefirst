import type {
  AnalyticsResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsResponse,
  UtmLink,
  AbTest,
  AbTestVariant,
  ProjectSettings,
  NotificationRule,
  Project
} from "@framefirst/types/api";

export type { UtmLink, AbTest, AbTestVariant, ProjectSettings, NotificationRule, Project };
export type { HeatmapReport } from "./demo-data";

import { cookies } from "next/headers";

import {
  demoAbTests,
  demoAnalytics,
  demoHeatmap,
  demoLinks,
  demoProjects,
  demoProjectForSite,
  demoSettings,
} from "./demo-data";
import { isDemoMode } from "./demo-mode";
import { internalApiUrl } from "./config";

export const devAuthHeaders = {
  "x-framefirst-dev-user": "00000000-0000-4000-8000-000000000001",
  "x-framefirst-dev-email": "dev@framefirst.local"
} as const;

function getAuthHeaders() {
  const token = cookies().get("ff_access_token")?.value;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  // Fallback to dev auth headers if no token (for local dev backdoor)
  return devAuthHeaders;
}

export async function getAnalytics(siteId: string): Promise<AnalyticsResponse> {
  if (isDemoMode()) {
    return demoAnalytics;
  }

  const response = await fetch(`${internalApiUrl}/analytics/${siteId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Analytics request failed with ${response.status}`);
  }

  return response.json() as Promise<AnalyticsResponse>;
}

export async function getProjects(): Promise<ListProjectsResponse> {
  if (isDemoMode()) {
    return demoProjects;
  }

  const response = await fetch(`${internalApiUrl}/projects`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Projects request failed with ${response.status}`);
  }

  return response.json() as Promise<ListProjectsResponse>;
}

export async function createProject(
  input: CreateProjectRequest
): Promise<CreateProjectResponse> {
  if (isDemoMode()) {
    const project = demoProjectForSite("ff_demo_new");
    return {
      project: { ...project, name: input.name, siteUrl: input.siteUrl ?? project.siteUrl },
      scriptTag: `<script async src="https://cdn.framefirst.app/ff.js" data-site-id="ff_demo_new"></script>`,
    };
  }

  const response = await fetch(`${internalApiUrl}/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Project create failed with ${response.status}`);
  }

  return response.json() as Promise<CreateProjectResponse>;
}

export async function getProject(siteId: string): Promise<Project | null> {
  if (isDemoMode()) {
    return demoProjectForSite(siteId);
  }

  const response = await fetch(`${internalApiUrl}/projects/snippet/${encodeURIComponent(siteId)}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Project request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { project: Project };
  return payload.project;
}

export async function getLinks(siteId: string) {
  if (isDemoMode()) {
    return demoLinks;
  }

  const response = await fetch(`${internalApiUrl}/links?project_id=${siteId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Links request failed with ${response.status}`);
  }
  return response.json();
}

export async function getAbTests(siteId: string) {
  if (isDemoMode()) {
    return demoAbTests;
  }

  const response = await fetch(`${internalApiUrl}/ab-tests?project_id=${siteId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`A/B Tests request failed with ${response.status}`);
  }
  return response.json();
}

export async function getProjectSettings(siteId: string) {
  if (isDemoMode()) {
    return demoSettings;
  }

  const response = await fetch(`${internalApiUrl}/settings/${siteId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Settings request failed with ${response.status}`);
  }
  return response.json();
}

export async function getHeatmap(siteId: string) {
  if (isDemoMode()) {
    return demoHeatmap;
  }

  const response = await fetch(`${internalApiUrl}/heatmaps/${siteId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Heatmap request failed with ${response.status}`);
  }

  return response.json();
}

export async function updateProjectSettings(siteId: string, input: any) {
  if (isDemoMode()) {
    return { ok: true, ...demoSettings, ...input };
  }

  const response = await fetch(`${internalApiUrl}/settings/${siteId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to update settings with ${response.status}`);
  }
  return response.json();
}

export async function createLink(input: any) {
  if (isDemoMode()) {
    return { ok: true, id: "demo-link" };
  }

  const response = await fetch(`${internalApiUrl}/links`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to create link with ${response.status}`);
  }
  return response.json();
}

export async function deleteLink(id: string) {
  if (isDemoMode()) {
    return { ok: true };
  }

  const response = await fetch(`${internalApiUrl}/links/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to delete link with ${response.status}`);
  }
  return response.json();
}

export async function deleteProject(id: string) {
  if (isDemoMode()) {
    return { ok: true };
  }

  const response = await fetch(`${internalApiUrl}/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Fastify DELETE project failed: ${response.status} ${text}`);
    throw new Error(`Failed to delete project with ${response.status}: ${text}`);
  }
  return response.json();
}
