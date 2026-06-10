type FrameFirstEventType = "pageview" | "click" | "custom" | "formsubmit";

type EventPayload = {
  site_id: string;
  session_id: string;
  anonymous_id: string;
  event_type: FrameFirstEventType;
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

declare global {
  interface Window {
    FrameFirst?: {
      track: (eventName: string, properties?: Record<string, string | number | boolean>) => void;
    };
  }
}

const ANONYMOUS_ID_KEY = "_ff_aid";
const SESSION_ID_KEY = "_ff_sid";
const SESSION_LAST_ACTIVE_KEY = "_ff_sid_last";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function run(): void {
  safe(() => {
    const script = document.currentScript;

    if (!(script instanceof HTMLScriptElement)) {
      return;
    }

    const siteId = script.dataset.site ?? "";

    if (!siteId) {
      return;
    }

    const endpoint = script.dataset.endpoint ?? new URL("/collect", script.src).toString();
    const anonymousId = getOrCreateAnonymousId();
    let lastUrl = window.location.href;

    window.FrameFirst = {
      track: (eventName) => {
        send(endpoint, buildEvent(siteId, anonymousId, "custom", 0, 0, eventName));
      }
    };

    send(endpoint, buildEvent(siteId, anonymousId, "pageview"));

    document.addEventListener(
      "click",
      (event) => {
        safe(() => {
          const target = event.target instanceof Element ? event.target : null;
          const xPct = clamp(event.clientX / Math.max(window.innerWidth, 1));
          const yPct = clamp(event.clientY / Math.max(window.innerHeight, 1));
          send(endpoint, buildEvent(siteId, anonymousId, "click", xPct, yPct, selectorFor(target)));
        });
      },
      { capture: true, passive: true }
    );

    document.addEventListener(
      "submit",
      (event) => {
        safe(() => {
          const target = event.target instanceof Element ? event.target : null;
          send(endpoint, buildEvent(siteId, anonymousId, "formsubmit", 0, 0, selectorFor(target)));
        });
      },
      { capture: true }
    );

    window.addEventListener("framer:click", () => {
      send(endpoint, buildEvent(siteId, anonymousId, "click"));
    });

    window.addEventListener("framer:formsubmit", () => {
      send(endpoint, buildEvent(siteId, anonymousId, "formsubmit"));
    });

    patchHistory(() => {
      window.setTimeout(() => {
        safe(() => {
          if (window.location.href === lastUrl) {
            return;
          }

          lastUrl = window.location.href;
          send(endpoint, buildEvent(siteId, anonymousId, "pageview"));
        });
      }, 0);
    });
  });
}

function buildEvent(
  siteId: string,
  anonymousId: string,
  eventType: FrameFirstEventType,
  xPct = 0,
  yPct = 0,
  elementSelector = ""
): EventPayload {
  const utm = getUtmParams();

  return {
    site_id: siteId,
    session_id: getOrCreateSessionId(),
    anonymous_id: anonymousId,
    event_type: eventType,
    url: window.location.href,
    referrer: document.referrer,
    utm_source: utm.get("utm_source") ?? "",
    utm_medium: utm.get("utm_medium") ?? "",
    utm_campaign: utm.get("utm_campaign") ?? "",
    utm_term: utm.get("utm_term") ?? "",
    utm_content: utm.get("utm_content") ?? "",
    x_pct: xPct,
    y_pct: yPct,
    element_selector: elementSelector,
    variant_id: getVariantId(),
    country: "",
    device: window.navigator.userAgent,
    timestamp: new Date().toISOString()
  };
}

function send(endpoint: string, payload: EventPayload): void {
  safe(() => {
    const body = JSON.stringify(payload);
    
    // For local testing with tunnels, we must use fetch to pass bypass headers
    const isLocalTunnel = endpoint.includes("ngrok") || endpoint.includes("loca.lt");

    if (navigator.sendBeacon && !isLocalTunnel) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    void fetch(endpoint, {
      method: "POST",
      headers: { 
        "content-type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "Bypass-Tunnel-Reminder": "true"
      },
      body,
      keepalive: true,
      mode: "cors"
    });
  });
}

function getOrCreateAnonymousId(): string {
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY);

  if (existing) {
    return existing;
  }

  const id = createId();
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

function getOrCreateSessionId(): string {
  const now = Date.now();
  const lastActive = Number(sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY) ?? "0");
  const existing = sessionStorage.getItem(SESSION_ID_KEY);

  if (existing && now - lastActive < SESSION_TIMEOUT_MS) {
    sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
    return existing;
  }

  const id = createId();
  sessionStorage.setItem(SESSION_ID_KEY, id);
  sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  return id;
}

function getUtmParams(): URLSearchParams {
  let search = window.location.search;

  try {
    const navEntries = performance.getEntriesByType("navigation");
    if (navEntries && navEntries.length > 0) {
      const entry = navEntries[0] as PerformanceNavigationTiming;
      if (entry && entry.name) {
        const url = new URL(entry.name);
        if (url.search) {
          search = url.search;
        }
      }
    }
  } catch {
    // Ignore
  }

  const currentUtms = new URLSearchParams(search);
  const hasCampaign = currentUtms.has("utm_campaign") || currentUtms.has("utm_source");

  try {
    if (hasCampaign) {
      sessionStorage.setItem("_ff_utms", search);
      return currentUtms;
    }
    const stored = sessionStorage.getItem("_ff_utms");
    if (stored) {
      return new URLSearchParams(stored);
    }
  } catch {
    // Ignore
  }

  return currentUtms;
}

function getVariantId(): string {
  const raw = sessionStorage.getItem("_ff_variants");

  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.values(parsed).join(",");
  } catch {
    return "";
  }
}

function selectorFor(element: Element | null): string {
  if (!element) {
    return "";
  }

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${cssEscape(element.id)}` : "";
  const firstClass = element.classList[0] ? `.${cssEscape(element.classList[0])}` : "";
  return `${tag}${id}${firstClass}`;
}

function patchHistory(onChange: () => void): void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushStatePatched(...args) {
    const result = originalPushState.apply(this, args);
    onChange();
    return result;
  };

  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplaceState.apply(this, args);
    onChange();
    return result;
  };

  window.addEventListener("popstate", onChange);
}

function createId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `ff_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function cssEscape(value: string): string {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // Tracking must never break the host page.
  }
}

run();
