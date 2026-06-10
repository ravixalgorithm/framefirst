import { NextResponse } from "next/server";
import { createLink } from "../../../lib/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await createLink(body);
    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create link" },
      { status: 500 }
    );
  }
}
