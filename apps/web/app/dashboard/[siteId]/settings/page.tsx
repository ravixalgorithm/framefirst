import { notFound } from "next/navigation";

import { SettingsPanel } from "../../../../components/settings-panel";
import { TestNotificationPanel } from "../../../../components/test-notification-panel";
import { getProject, getProjectSettings } from "../../../../lib/api";
import { scriptTagFor } from "../../../../lib/config";

type PageProps = {
  params: {
    siteId: string;
  };
};

export default async function SettingsPage({ params }: PageProps) {
  const [project, settings] = await Promise.all([
    getProject(params.siteId),
    getProjectSettings(params.siteId)
  ]);

  if (!project) {
    notFound();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <div className="space-y-8">
        <TestNotificationPanel siteId={params.siteId} />
        <SettingsPanel
          initialSettings={settings}
          project={project}
          siteId={params.siteId}
          scriptTag={scriptTagFor(params.siteId)}
          isActive={project.isActive}
        />
      </div>
    </>
  );
}
