import { cookies } from "next/headers";

export type Session = {
  id: string;
  email: string;
  name: string;
};

export function getSession(): Session | null {
  const value = cookies().get("ff_access_token")?.value;

  if (!value) {
    // Return dev fallback if no token but in dev mode
    if (process.env.NODE_ENV === "development") {
      return { id: "00000000-0000-4000-8000-000000000001", email: "dev@framefirst.local", name: "Dev User" };
    }
    return null;
  }

  try {
    const payloadBase64 = value.split(".")[1];
    if (!payloadBase64) return null;
    const parsed = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));

    if (!parsed.email) {
      return null;
    }

    return {
      id: parsed.id,
      email: parsed.email,
      name: nameFromEmail(parsed.email)
    };
  } catch {
    return null;
  }
}

function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "User";
}
