export const eventTypes = ["pageview", "click", "custom", "formsubmit"] as const;

export type EventType = (typeof eventTypes)[number];

export type EventRow = {
  site_id: string;
  session_id: string;
  anonymous_id: string;
  event_type: EventType;
  url: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  x_pct: number;
  y_pct: number;
  element_selector: string;
  variant_id: string;
  country: string;
  device: string;
  timestamp: string;
};

export type TrackPayload = Omit<EventRow, "country" | "timestamp"> & {
  timestamp?: string;
};
