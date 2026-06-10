"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useOneSignal } from "./onesignal-provider";

export function NotificationPrompt() {
  const oneSignal = useOneSignal();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const wasDismissed = localStorage.getItem("ff_notif_dismissed");
    if (wasDismissed) return;

    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible || dismissed) return null;

  function handleEnable() {
    void oneSignal.enableNotifications().catch((error) => {
      console.error("[NotificationPrompt] Enable failed:", error);
    });
    setVisible(false);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("ff_notif_dismissed", "true");
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border p-5 flex gap-4 items-start">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Enable notifications
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Get instant alerts when your traffic spikes, new visitors arrive, or A/B tests complete.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnable}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
