import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Project not found</h1>
      <p className="text-sm text-muted-foreground">
        This workspace does not exist or you do not have access to it. Open your projects list and use the Dashboard button on a real project.
      </p>
      <Link
        href="/projects"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Back to projects
      </Link>
    </div>
  );
}
