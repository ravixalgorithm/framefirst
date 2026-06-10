"use client";

import { CheckCircle2, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type InstallState = {
  verified: boolean;
  lastSeen: string | null;
  events: number;
};

type InstallVerifierProps = {
  siteId: string;
  scriptTag: string;
  siteUrl: string | null;
  initialVerified?: boolean;
};

export function InstallVerifier({
  siteId,
  scriptTag,
  siteUrl,
  initialVerified = false
}: InstallVerifierProps) {
  const [state, setState] = useState<InstallState>({
    verified: initialVerified,
    lastSeen: initialVerified ? new Date(Date.now() - 1000 * 60 * 12).toISOString() : null,
    events: initialVerified ? 128 : 0
  });
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (!state.verified) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/projects/${siteId}/status`);
          if (response.ok) {
            const data = await response.json();
            if (data.isActive) {
              setState((current) => ({
                ...current,
                verified: true,
                lastSeen: new Date().toISOString(),
                events: Math.max(current.events, 1)
              }));
              clearInterval(interval);
            }
          }
        } catch {
          // ignore
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [siteId, state.verified]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(siteId));

    if (saved) {
      setState((current) => parseState(saved, current));
    }
  }, [siteId]);

  useEffect(() => {
    if (initialVerified && !state.verified) {
      setState((current) => ({
        ...current,
        verified: true,
        lastSeen: new Date().toISOString(),
        events: Math.max(current.events, 1)
      }));
    }
  }, [initialVerified, state.verified]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(siteId), JSON.stringify(state));
  }, [siteId, state]);

  async function copyScript() {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function verifyInstall() {
    setChecking(true);
    try {
      const response = await fetch(`/api/projects/${siteId}/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.isActive) {
          setState((current) => ({
            ...current,
            verified: true,
            lastSeen: new Date().toISOString(),
            events: Math.max(current.events + 1, 1)
          }));
        } else {
          alert("We haven't received any events yet. Please make sure the script is installed and try visiting your site.");
        }
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="install-verifier">
      <div className={`install-status ${state.verified ? "active" : "waiting"}`}>
        <CheckCircle2 size={16} aria-hidden="true" />
        <span>
          <strong>{state.verified ? "Tracking active" : "Waiting for installation"}</strong>
          <small>
            {state.lastSeen
              ? `Last event ${relativeTime(state.lastSeen)}`
              : "Paste the script into your global site head, then verify."}
          </small>
        </span>
      </div>

      <code className="script-box light">{scriptTag}</code>

      <div className="install-steps">
        <span className="done">1. Copy snippet</span>
        <span className={state.verified ? "done" : ""}>2. Install globally</span>
        <span className={state.verified ? "done" : ""}>3. Confirm event</span>
      </div>

      <div className="actions padded">
        <button className="button" type="button" onClick={copyScript}>
          <Copy size={16} aria-hidden="true" />
          {copied ? "Copied" : "Copy script"}
        </button>
        <button className="button primary" disabled={checking} type="button" onClick={verifyInstall}>
          <RefreshCw size={16} aria-hidden="true" />
          {checking ? "Checking" : state.verified ? "Re-check" : "Verify installation"}
        </button>
        {siteUrl ? (
          <a className="button" href={siteUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Open site
          </a>
        ) : null}
      </div>
    </div>
  );
}

function storageKey(siteId: string): string {
  return `framefirst:${siteId}:install-status`;
}

function parseState(value: string, fallback: InstallState): InstallState {
  try {
    const parsed = JSON.parse(value) as InstallState;

    if (typeof parsed.verified !== "boolean") {
      return fallback;
    }

    return {
      verified: parsed.verified,
      lastSeen: parsed.lastSeen ?? null,
      events: Number.isFinite(parsed.events) ? parsed.events : 0
    };
  } catch {
    return fallback;
  }
}

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
}
