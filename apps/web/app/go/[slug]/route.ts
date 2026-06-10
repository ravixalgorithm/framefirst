import { NextResponse, type NextRequest } from "next/server";
import { internalApiUrl } from "../../../lib/config";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const response = await fetch(`${internalApiUrl}/links/go/${params.slug}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      // If link not found, just redirect to the app homepage or show a 404
      return NextResponse.redirect(new URL("/", request.url));
    }

    const { url } = await response.json();
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("Redirect error:", e);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
