"use client";

import { Bell, CheckCircle2, FileCode2, Save, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Project } from "@framefirst/types/api";

import { MetricCard } from "./metric-card";
import { InstallVerifier } from "./install-verifier";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "./ui/card";
import type { ProjectSettings } from "../lib/api";

type SettingsPanelProps = {
  siteId: string;
  project: Project;
  scriptTag: string;
  initialSettings: ProjectSettings;
  isActive?: boolean | undefined;
};

export function SettingsPanel({
  siteId,
  project,
  scriptTag,
  initialSettings,
  isActive
}: SettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const goalType = settings.conversionGoal.type;
  const goalValue = settings.conversionGoal.value;
  const notifications = settings.notifications;
  const enabledCount = useMemo(
    () => notifications.filter((notification) => notification.enabled).length,
    [notifications]
  );

  useEffect(() => {
    const savedSettings = window.localStorage.getItem(storageKey(siteId));

    if (savedSettings) {
      setSettings(parseSettings(savedSettings, initialSettings));
    }

    setHydrated(true);
  }, [initialSettings, siteId]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(storageKey(siteId), JSON.stringify(settings));
    }
  }, [hydrated, settings, siteId]);

  async function saveSettingsToServer(newSettings: ProjectSettings) {
    try {
      await fetch(`/api/projects/${siteId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
    } catch {
      // Ignore
    }
  }

  async function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    await saveSettingsToServer(settings);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function setGoalType(type: ProjectSettings["conversionGoal"]["type"]) {
    setSettings((current) => ({
      ...current,
      conversionGoal: {
        ...current.conversionGoal,
        type
      }
    }));
  }

  function setGoalValue(value: string) {
    setSettings((current) => ({
      ...current,
      conversionGoal: {
        ...current.conversionGoal,
        value
      }
    }));
  }

  async function toggleNotification(id: string) {
    const newSettings = {
      ...settings,
      notifications: settings.notifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              enabled: !notification.enabled
            }
          : notification
      )
    };
    setSettings(newSettings);
    await saveSettingsToServer(newSettings);
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          label="Goal"
          value={goalType}
          sub={goalValue}
        />
        <MetricCard
          label="Snippet"
          value="Active"
          sub="Last seen recently"
          tone="good"
        />
        <MetricCard
          label="Alerts"
          value={String(enabledCount)}
          sub="Enabled rules"
        />
        <MetricCard
          label="Domains"
          value={String(project.allowedDomains.length)}
          sub="Allowed origins"
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-6 auto-rows-max">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold">Notifications</CardTitle>
                <CardDescription>{enabledCount} enabled</CardDescription>
              </div>
              <Bell size={18} className="text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {notifications.map((notification) => (
                <label className="flex items-center justify-between cursor-pointer" key={notification.id}>
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">{notification.label}</div>
                    <div className="text-xs text-muted-foreground">{notification.threshold}</div>
                  </div>
                  <input
                    checked={notification.enabled}
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    onChange={() => toggleNotification(notification.id)}
                  />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 auto-rows-max">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <strong className="font-medium text-foreground">{project.name}</strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Site</span>
                <strong className="font-medium text-foreground">{project.siteUrl ?? "--"}</strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Snippet key</span>
                <strong className="font-medium text-foreground">{project.snippetKey}</strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <strong className="flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Active
                </strong>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Tracking snippet</CardTitle>
            </CardHeader>
            <CardContent>
              <InstallVerifier
                initialVerified={isActive ?? false}
                scriptTag={scriptTag}
                siteId={siteId}
                siteUrl={project.siteUrl}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function storageKey(siteId: string): string {
  return `framefirst:${siteId}:settings`;
}

function parseSettings(value: string, fallback: ProjectSettings): ProjectSettings {
  try {
    const parsed = JSON.parse(value) as ProjectSettings;

    if (!parsed.conversionGoal || !Array.isArray(parsed.notifications)) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}
