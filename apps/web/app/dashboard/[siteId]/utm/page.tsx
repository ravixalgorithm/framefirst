import { notFound } from "next/navigation";

import { UtmBuilder } from "../../../../components/utm-builder";
import { getLinks, getProject } from "../../../../lib/api";

type PageProps = {
  params: {
    siteId: string;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UtmPage({ params }: PageProps) {
  const [links, project] = await Promise.all([
    getLinks(params.siteId),
    getProject(params.siteId)
  ]);

  if (!project) {
    notFound();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">UTM Links</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <UtmBuilder initialLinks={links} siteId={params.siteId} />
    </>
  );
}
