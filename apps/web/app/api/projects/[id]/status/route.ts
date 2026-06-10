import { NextResponse } from "next/server";
import { getProject } from "../../../../lib/api";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const project = await getProject(params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ isActive: project.isActive ?? false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check project status" },
      { status: 500 }
    );
  }
}
