import type { FastifyInstance } from "fastify";

import { ensureEventsTable, queryEvents } from "@framefirst/db/clickhouse";
import type {
  AnalyticsResponse,
  ConversionGoal,
  AnalyticsSummary
} from "@framefirst/types/api";

import { authorizeProjectRead } from "../lib/authz.js";
import {
  findProjectAnalyticsConfig
} from "../lib/projects.js";
import { redis } from "../lib/redis.js";

const analyticsSchema = {
  params: {
    type: "object",
    required: ["site_id"],
    properties: {
      site_id: { type: "string", minLength: 1, maxLength: 128 }
    }
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      from: { type: "string", minLength: 1, maxLength: 64 },
      to: { type: "string", minLength: 1, maxLength: 64 }
    }
  }
} as const;

type AnalyticsParams = {
  site_id: string;
};

type AnalyticsQuery = {
  from?: string;
  to?: string;
};

type NumericLike = number | string | null | undefined;

type SummaryRow = {
  visitors: NumericLike;
  pageviews: NumericLike;
  sessions: NumericLike;
};

type BounceRow = {
  bounced_sessions: NumericLike;
  total_sessions: NumericLike;
};

type DurationRow = {
  avg_session_duration: NumericLike;
};

type ChartRow = {
  date: string;
  visitors: NumericLike;
  pageviews: NumericLike;
};

type TopPageRow = {
  url: string;
  pageviews: NumericLike;
  visitors: NumericLike;
};

type TopReferrerRow = {
  referrer: string;
  visitors: NumericLike;
};

type DeviceRow = {
  device: string;
  count: NumericLike;
};

type CountryRow = {
  country: string;
  visitors: NumericLike;
};

type UtmSourceRow = {
  utm_source: string;
  visitors: NumericLike;
};

type ConversionRow = {
  conversions: NumericLike;
};

const baseWhere = `
site_id = {siteId:String}
AND timestamp >= parseDateTimeBestEffort({from:String})
AND timestamp < parseDateTimeBestEffort({to:String})
`;

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/analytics/:site_id",
    { schema: analyticsSchema },
    async (request, reply) => {
      const params = request.params as AnalyticsParams;
      const query = request.query as AnalyticsQuery;
      const siteId = params.site_id;
      const range = getDateRange(query);

      const project = await findProjectAnalyticsConfig(siteId);

      if (!project) {
        return reply.code(404).send({
          error: "Project not found",
          code: "PROJECT_NOT_FOUND"
        });
      }

      const authorized = await authorizeProjectRead(fastify, request, reply, siteId);

      if (!authorized) {
        return undefined;
      }

      const cacheKey = `analytics:${siteId}:${range.from}:${range.to}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as AnalyticsResponse;
      }

      await ensureEventsTable();

      const response = await buildAnalyticsResponse(
        siteId,
        range.from,
        range.to,
        project.conversionGoal
      );

      await redis.set(cacheKey, JSON.stringify(response), "EX", 60);

      return response;
    }
  );
}

async function buildAnalyticsResponse(
  siteId: string,
  from: string,
  to: string,
  conversionGoal: ConversionGoal | null
): Promise<AnalyticsResponse> {
  const queryParams = { siteId, from, to };

  const [
    summaryRows,
    bounceRows,
    durationRows,
    chartRows,
    topPageRows,
    topReferrerRows,
    deviceRows,
    countryRows,
    utmSourceRows,
    conversionRows
  ] = await Promise.all([
    queryEvents<SummaryRow>(
      `
      SELECT
        uniqExact(anonymous_id) AS visitors,
        countIf(event_type = 'pageview') AS pageviews,
        uniqExact(session_id) AS sessions
      FROM events
      WHERE ${baseWhere}
      `,
      queryParams
    ),
    queryEvents<BounceRow>(
      `
      SELECT
        countIf(pageviews = 1) AS bounced_sessions,
        count() AS total_sessions
      FROM (
        SELECT session_id, countIf(event_type = 'pageview') AS pageviews
        FROM events
        WHERE ${baseWhere}
        GROUP BY session_id
      )
      `,
      queryParams
    ),
    queryEvents<DurationRow>(
      `
      SELECT ifNull(avg(duration), 0) AS avg_session_duration
      FROM (
        SELECT dateDiff('second', min(timestamp), max(timestamp)) AS duration
        FROM events
        WHERE ${baseWhere}
        GROUP BY session_id
      )
      `,
      queryParams
    ),
    queryEvents<ChartRow>(
      `
      SELECT
        toString(toDate(timestamp)) AS date,
        uniqExact(anonymous_id) AS visitors,
        countIf(event_type = 'pageview') AS pageviews
      FROM events
      WHERE ${baseWhere}
      GROUP BY date
      ORDER BY date ASC
      `,
      queryParams
    ),
    queryEvents<TopPageRow>(
      `
      SELECT
        url,
        countIf(event_type = 'pageview') AS pageviews,
        uniqExact(anonymous_id) AS visitors
      FROM events
      WHERE ${baseWhere}
      AND event_type = 'pageview'
      GROUP BY url
      ORDER BY pageviews DESC
      LIMIT 10
      `,
      queryParams
    ),
    queryEvents<TopReferrerRow>(
      `
      SELECT
        referrer,
        uniqExact(anonymous_id) AS visitors
      FROM events
      WHERE ${baseWhere}
      AND event_type = 'pageview'
      AND referrer != ''
      GROUP BY referrer
      ORDER BY visitors DESC
      LIMIT 10
      `,
      queryParams
    ),
    queryEvents<DeviceRow>(
      `
      SELECT
        device,
        count() AS count
      FROM events
      WHERE ${baseWhere}
      AND device != ''
      GROUP BY device
      ORDER BY count DESC
      LIMIT 10
      `,
      queryParams
    ),
    queryEvents<CountryRow>(
      `
      SELECT
        country,
        uniqExact(anonymous_id) AS visitors
      FROM events
      WHERE ${baseWhere}
      AND country != ''
      GROUP BY country
      ORDER BY visitors DESC
      LIMIT 10
      `,
      queryParams
    ),
    queryEvents<UtmSourceRow>(
      `
      SELECT
        utm_source,
        uniqExact(anonymous_id) AS visitors
      FROM events
      WHERE ${baseWhere}
      AND utm_source != ''
      GROUP BY utm_source
      ORDER BY visitors DESC
      LIMIT 10
      `,
      queryParams
    ),
    conversionGoal
      ? queryEvents<ConversionRow>(
          `
          SELECT uniqExact(session_id) AS conversions
          FROM events
          WHERE ${baseWhere}
          AND ${conversionCondition(conversionGoal)}
          `,
          { ...queryParams, goalValue: conversionGoal.value }
        )
      : Promise.resolve([{ conversions: null }])
  ]);

  const summaryRow = summaryRows[0];
  const bounceRow = bounceRows[0];
  const durationRow = durationRows[0];
  const conversionCount = toNumber(conversionRows[0]?.conversions);
  const sessions = toNumber(summaryRow?.sessions);
  const cvr = conversionGoal && sessions > 0 ? (conversionCount / sessions) * 100 : null;

  const summary: AnalyticsSummary = {
    visitors: toNumber(summaryRow?.visitors),
    pageviews: toNumber(summaryRow?.pageviews),
    sessions,
    bounceRate: ratioPercent(
      toNumber(bounceRow?.bounced_sessions),
      toNumber(bounceRow?.total_sessions)
    ),
    avgSessionDuration: toNumber(durationRow?.avg_session_duration),
    cvr
  };

  return {
    summary,
    chart: chartRows.map((row) => ({
      date: row.date,
      visitors: toNumber(row.visitors),
      pageviews: toNumber(row.pageviews)
    })),
    topPages: topPageRows.map((row) => ({
      url: row.url,
      pageviews: toNumber(row.pageviews),
      visitors: toNumber(row.visitors)
    })),
    topReferrers: topReferrerRows.map((row) => ({
      referrer: row.referrer,
      visitors: toNumber(row.visitors)
    })),
    devices: deviceRows.map((row) => ({
      device: row.device,
      count: toNumber(row.count)
    })),
    countries: countryRows.map((row) => ({
      country: row.country,
      visitors: toNumber(row.visitors)
    })),
    utmSources: utmSourceRows.map((row) => ({
      utm_source: row.utm_source,
      visitors: toNumber(row.visitors),
      cvr: null
    }))
  };
}

function conversionCondition(goal: ConversionGoal): string {
  if (goal.type === "pageview") {
    return "event_type = 'pageview' AND position(url, {goalValue:String}) > 0";
  }

  if (goal.type === "click") {
    return "event_type = 'click' AND element_selector = {goalValue:String}";
  }

  return "event_type = 'custom' AND element_selector = {goalValue:String}";
}

function getDateRange(query: AnalyticsQuery): { from: string; to: string } {
  const to = parseDate(query.to) ?? new Date();
  const from =
    parseDate(query.from) ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ratioPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function toNumber(value: NumericLike): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
