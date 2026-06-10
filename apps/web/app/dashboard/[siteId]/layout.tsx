import { notFound } from "next/navigation";

import { DashboardShell } from "../../../components/dashboard-shell";
import { getProject, getProjects } from "../../../lib/api";
import { getSession } from "../../../lib/session";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: {
    siteId: string;
  };
};

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const session = getSession();
  const [project, projectsResponse] = await Promise.all([
    getProject(params.siteId),
    getProjects()
  ]);

  if (!project) {
    notFound();
  }

  const projects = projectsResponse.projects.some(
    (item) => item.snippetKey === project.snippetKey
  )
    ? projectsResponse.projects
    : [project, ...projectsResponse.projects];

  return (
    <DashboardShell
      siteId={params.siteId}
      project={project}
      projects={projects}
      userEmail={session?.email ?? "dev@framefirst.local"}
    >
      {children}
    </DashboardShell>
  );
}
