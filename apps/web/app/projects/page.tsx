import { Code2, Search, Settings } from "lucide-react";
import { NewProjectModal } from "../../components/new-project-modal";
import { LogoutButton } from "../../components/logout-button";
import { CopySnippetButton } from "../../components/copy-snippet-button";
import { DeleteProjectButton } from "../../components/delete-project-button";
import { AutoRefreshProjects } from "../../components/auto-refresh-projects";
import { getProjects } from "../../lib/api";
import { getSession } from "../../lib/session";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projectsResult = await loadProjects();
  const session = getSession();
  const projects = projectsResult.projects;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AutoRefreshProjects />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b bg-muted/40 px-4 sm:px-6">
          <div className="flex items-center gap-4 font-semibold">
            <a href="/projects">Frame First</a>
            <nav className="hidden md:flex items-center gap-4 text-sm font-normal text-muted-foreground ml-6">
              <a href="/projects" className="text-foreground font-medium">Projects</a>
              <a href="https://docs.framefirst.local" target="_blank" rel="noreferrer" className="hover:text-foreground">Docs</a>
              <a href="#" className="hover:text-foreground">Settings</a>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:inline text-sm text-muted-foreground">{session?.email ?? "dev@framefirst.local"}</span>
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
              {(session?.email ?? "D").slice(0, 1).toUpperCase()}
            </div>
            <div className="w-24 sm:w-auto">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
                <p className="text-muted-foreground">Telemetry & Analytics Dashboard</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Search projects..." className="w-full sm:w-64 pl-8" />
                </div>
                <NewProjectModal />
              </div>
            </div>

            {projectsResult.error ? (
              <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                {projectsResult.error}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <Card key={project.id} className="flex flex-col">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <Badge variant={project.isActive ? "default" : "secondary"}>
                          {project.isActive ? "ACTIVE" : "SETUP"}
                        </Badge>
                      </CardHeader>
                      <CardContent className="flex-1 pb-4">
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Domain</span>
                            <span className="font-medium">{project.siteUrl ? new URL(project.siteUrl).hostname : "Not configured"}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Snippet Key</span>
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                              {project.snippetKey}
                            </code>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center gap-2 pt-4 border-t bg-muted/20">
                        <CopySnippetButton siteId={project.snippetKey} />
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/dashboard/${project.snippetKey}`}>
                            <Settings className="mr-2 h-4 w-4" /> Dashboard
                          </a>
                        </Button>
                        <DeleteProjectButton projectId={project.id} projectName={project.name} />
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border rounded-lg border-dashed">
                    <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Projects Found</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">Create a new workspace to start tracking telemetry.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

async function loadProjects() {
  try {
    const response = await getProjects();
    return { projects: response.projects, error: null };
  } catch (error) {
    return { projects: [], error: error instanceof Error ? error.message : "Projects could not be loaded" };
  }
}
