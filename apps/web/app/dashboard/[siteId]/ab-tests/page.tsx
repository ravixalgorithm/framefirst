import { AbTestsWorkbench } from "../../../../components/ab-tests-workbench";
import { getAbTests, getProject } from "../../../../lib/api";

type PageProps = {
  params: {
    siteId: string;
  };
};

export default async function AbTestsPage({ params }: PageProps) {
  const [tests, project] = await Promise.all([
    getAbTests(params.siteId),
    getProject(params.siteId)
  ]);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">A/B Tests</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <AbTestsWorkbench initialTests={tests} />
    </>
  );
}
