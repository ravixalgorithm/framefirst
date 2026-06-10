"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CreateProjectResponse } from "@framefirst/types/api";

export function CreateProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedSiteUrl = siteUrl.trim();

    if (trimmedName.length < 2) {
      setError("Project name must be at least 2 characters.");
      return;
    }

    if (trimmedSiteUrl && !isValidUrl(trimmedSiteUrl)) {
      setError("Enter a full URL like https://example.com.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: trimmedName,
          siteUrl: trimmedSiteUrl || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Create failed with ${response.status}`);
      }

      const payload = (await response.json()) as CreateProjectResponse;
      router.push(`/dashboard/${payload.project.snippetKey}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be created");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          name="name"
          required
          maxLength={120}
          placeholder="Marketing site"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="project-url">Site URL</label>
        <input
          id="project-url"
          name="siteUrl"
          placeholder="https://example.com"
          type="url"
          value={siteUrl}
          onChange={(event) => setSiteUrl(event.target.value)}
        />
      </div>
      {error ? <div className="error compact">{error}</div> : null}
      <button className="button primary" disabled={loading} type="submit">
        <Plus size={16} aria-hidden="true" />
        {loading ? "Creating" : "Create project"}
      </button>
    </form>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
