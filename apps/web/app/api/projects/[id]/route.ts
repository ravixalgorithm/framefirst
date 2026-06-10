import { NextResponse } from "next/server";
import { deleteProject } from "../../../../lib/api";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const response = await deleteProject(params.id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
