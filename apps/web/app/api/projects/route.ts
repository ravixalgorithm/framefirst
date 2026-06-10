import { NextResponse } from "next/server";

import type { CreateProjectRequest } from "@framefirst/types/api";

import { createProject } from "../../../lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateProjectRequest;
    const response = await createProject(body);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
