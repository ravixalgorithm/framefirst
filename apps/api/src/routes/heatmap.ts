import type { FastifyInstance } from "fastify";
import { queryEvents } from "@framefirst/db";

export async function heatmapRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { site_id: string }, Querystring: { url: string } }>("/heatmap/:site_id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { site_id } = request.params;
    const { url } = request.query;

    if (!url) {
      return reply.code(400).send({ error: "url is required" });
    }

    const query = `
      SELECT 
        round(x_pct, 2) as x_pct,
        round(y_pct, 2) as y_pct,
        count() as count
      FROM events
      WHERE site_id = {siteId:String} 
        AND url = {url:String}
        AND event_type = 'click'
      GROUP BY x_pct, y_pct
      HAVING count > 0
    `;

    const points = await queryEvents<{ x_pct: number; y_pct: number; count: number }>(query, {
      siteId: site_id,
      url
    });

    return { points };
  });
}
