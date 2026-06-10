import { NextResponse } from "next/server";
import { updateProjectSettings } from "../../../../../lib/api";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const response = await updateProjectSettings(params.id, body);
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Failed to update project settings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update project settings" },
      { status: 500 }
    );
  }
}
