"use client";

import { BellRing, Loader2, Send, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { getServiceWorkerDiagnostics } from "@/lib/onesignal-client";
import { useOneSignal } from "./onesignal-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

type TestNotificationPanelProps = {
  siteId: string;
};

function permissionHint(options: {
  permission: NotificationPermission | "unsupported";
  isReady: boolean;
  pushCapable: boolean;
  pushCapableReason: string | null;
  isSubscribed: boolean;
  subscriptionId: string | null;
}) {
  const { permission, isReady, pushCapable, pushCapableReason, isSubscribed, subscriptionId } = options;

  if (!pushCapable && pushCapableReason) {
    return pushCapableReason;
  }

  if (!isReady) {
    return "Loading push SDK...";
  }

  if (permission === "unsupported") {
    return "Notification API unavailable in this browser tab. Try Chrome on Android, or Safari (added to Home Screen) on iPhone.";
  }

  if (permission === "denied") {
    return "Notifications are blocked. Open browser site settings and allow notifications for this site.";
  }

  if (permission === "default") {
    return "Tap Enable notifications, then allow the browser prompt.";
  }

  if (permission === "granted" && !isSubscribed && !subscriptionId) {
    return "Notifications are allowed, but this device is not registered with OneSignal yet. Tap Enable notifications.";
  }

  return null;
}

export function TestNotificationPanel({ siteId }: TestNotificationPanelProps) {
  const {
    isReady,
    isSubscribed,
    subscriptionId,
    permission,
    pushCapable,
    pushCapableReason,
    pushEnvironment,
    initError,
    enableNotifications,
    refreshSubscription,
  } = useOneSignal();
  const [title, setTitle] = useState("Frame First test");
  const [message, setMessage] = useState("Your custom push notification is working!");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [swDebug, setSwDebug] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<{ secure: boolean; origin: string } | null>(null);

  useEffect(() => {
    setClientInfo({
      secure: window.isSecureContext,
      origin: window.location.origin,
    });
  }, []);

  async function refreshSwDebug() {
    const sw = await getServiceWorkerDiagnostics();
    setSwDebug(
      sw.registrations.length === 0
        ? "No service worker registered yet."
        : `${sw.registrations.map((item) => `${item.state} · ${item.script.split("/").pop()}`).join(" | ")}${
            sw.browserPushEndpoint ? " · push endpoint active" : ""
          }`
    );
  }

  useEffect(() => {
    if (isReady) {
      void refreshSubscription();
      void refreshSwDebug();
    }
  }, [isReady, refreshSubscription]);

  async function handleEnable() {
    setEnabling(true);
    setStatus(null);
    const subscription = await enableNotifications();

    if (subscription.permission === "denied") {
      setStatus("Notifications are blocked in your browser. Allow them in site settings, then tap Enable again.");
    } else if (subscription.optedIn && subscription.id) {
      setStatus("Notifications enabled on this device. You can send a test now.");
    } else if (subscription.permission === "granted") {
      setStatus(
        subscription.error ??
          "Permission granted but OneSignal has not finished registering. Clear site data for this URL, refresh, then tap Enable again."
      );
    } else {
      setStatus("Tap Allow when your browser asks for notification permission.");
    }

    await refreshSwDebug();

    setEnabling(false);
  }

  async function sendTest() {
    setSending(true);
    setStatus(null);

    let subscription = await refreshSubscription();

    if (!subscription.optedIn || !subscription.id) {
      subscription = await enableNotifications();
    }

    if (subscription.permission === "denied") {
      setStatus("Notifications are blocked. Allow them in browser settings first.");
      setSending(false);
      return;
    }

    if (!subscription.optedIn && subscription.permission !== "granted") {
      setStatus("Enable notifications first, then send the test.");
      setSending(false);
      return;
    }

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          subscriptionId: subscription.id ?? undefined,
          url: `${window.location.origin}/dashboard/${siteId}`,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? payload.hint ?? "Failed to send notification");
      }

      setStatus(
        payload.targeted === "device"
          ? "Sent to this device. Check your phone in a few seconds."
          : "Sent to all subscribed users."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  const hint = permissionHint({
    permission,
    isReady,
    pushCapable,
    pushCapableReason,
    isSubscribed,
    subscriptionId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <BellRing size={20} />
          Test push notification
        </CardTitle>
        <CardDescription>
          Enable notifications on this phone, then send yourself a custom test message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <div className="font-medium">
            {isSubscribed && subscriptionId
              ? "This device is subscribed."
              : permission === "denied"
                ? "Notifications blocked on this device."
                : permission === "granted"
                  ? "Notifications allowed — finishing OneSignal registration."
                  : !pushCapable
                    ? "Web push not available in this browser."
                    : "Notifications not enabled on this device yet."}
          </div>
          {hint ? <p className="mt-1 text-muted-foreground">{hint}</p> : null}
          {clientInfo ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Browser: {pushEnvironment}
              {clientInfo.secure ? " · HTTPS" : " · not secure"}
              {permission !== "unsupported" ? ` · permission: ${permission}` : ""}
              {` · origin: ${clientInfo.origin}`}
            </p>
          ) : null}
          {swDebug ? <p className="mt-1 text-xs text-muted-foreground">Service worker: {swDebug}</p> : null}
          {subscriptionId ? (
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{subscriptionId}</p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Title</span>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Notification title"
            />
          </label>
          <label className="space-y-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Message</span>
            <textarea
              className="min-h-20 w-full rounded-lg border bg-background px-3 py-2"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Notification body"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleEnable}
            disabled={enabling || permission === "denied" || !pushCapable}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
          >
            {enabling ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
            Enable notifications
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send test
          </button>
        </div>

        {initError ? <p className="text-sm text-destructive">{initError}</p> : null}
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        {!isReady && !initError ? (
          <p className="text-sm text-muted-foreground">Loading OneSignal SDK...</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
