import { NextResponse } from "next/server";
import { deleteLink } from "../../../../lib/api";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const response = await deleteLink(params.id);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Failed to delete link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete link" },
      { status: 500 }
    );
  }
}
