import { eq } from "drizzle-orm";

import { db, projects, sql, users } from "./index.js";

const devUserId = "00000000-0000-4000-8000-000000000001";
const devEmail = "dev@framefirst.local";
const devSnippetKey = "ff_dev_site";

await db
  .insert(users)
  .values({
    id: devUserId,
    email: devEmail
  })
  .onConflictDoUpdate({
    target: users.id,
    set: {
      email: devEmail,
      updatedAt: new Date()
    }
  });

const [existingProject] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(eq(projects.snippetKey, devSnippetKey))
  .limit(1);

if (existingProject) {
  await db
    .update(projects)
    .set({
      name: "Local Test Site",
      siteUrl: "http://localhost:3001/test-site",
      allowedDomains: ["localhost", "127.0.0.1"],
      updatedAt: new Date()
    })
    .where(eq(projects.snippetKey, devSnippetKey));
} else {
  await db.insert(projects).values({
    userId: devUserId,
    name: "Local Test Site",
    siteUrl: "http://localhost:3001/test-site",
    snippetKey: devSnippetKey,
    allowedDomains: ["localhost", "127.0.0.1"]
  });
}

await sql.end();

console.log("Seeded local Frame First project");
console.log(`Email: ${devEmail}`);
console.log(`Snippet key: ${devSnippetKey}`);
console.log(
  `<script src="http://localhost:3001/track.js" data-site="${devSnippetKey}" async></script>`
);
