import type { FastifyInstance } from "fastify";

export async function testSiteRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/test-site", async (_request, reply) => {
    return reply.type("text/html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Frame First Local Test Site</title>
    <script src="/track.js" data-site="ff_dev_site" async></script>
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f7f4;
        color: #181816;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
        padding: 72px 24px;
      }
      button, input {
        font: inherit;
      }
      button {
        border: 0;
        border-radius: 8px;
        padding: 12px 16px;
        background: #181816;
        color: white;
        cursor: pointer;
      }
      form {
        display: flex;
        gap: 8px;
        margin-top: 24px;
      }
      input {
        min-width: 0;
        flex: 1;
        border: 1px solid #d8d8d0;
        border-radius: 8px;
        padding: 12px;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Frame First local test site</p>
      <h1>Tracking is installed with one script tag.</h1>
      <p>Open devtools Network tab, click the button, submit the form, and watch /collect.</p>
      <button id="hero-cta" class="cta">Track a click</button>
      <form>
        <input name="email" type="email" placeholder="you@example.com" />
        <button type="submit">Submit form</button>
      </form>
    </main>
  </body>
</html>`);
  });
}
