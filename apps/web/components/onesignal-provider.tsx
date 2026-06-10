"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

import {
  detectPushEnvironment,
  enableBrowserPush,
  getBrowserPermission,
  getOneSignalClient,
  isNativePushCapable,
  readSubscriptionState,
  type PushDiagnostics,
  type PushEnvironment,
} from "../lib/onesignal-client";

export type PushSubscriptionState = {
  optedIn: boolean;
  id: string | null;
  permission: NotificationPermission | "unsupported";
};

type OneSignalContextValue = {
  isReady: boolean;
  isSubscribed: boolean;
  subscriptionId: string | null;
  permission: NotificationPermission | "unsupported";
  pushCapable: boolean;
  pushCapableReason: string | null;
  pushEnvironment: PushEnvironment;
  initError: string | null;
  promptPush: () => void;
  enableNotifications: () => Promise<PushSubscriptionState & { error?: string; diagnostics?: PushDiagnostics }>;
  refreshSubscription: () => Promise<PushSubscriptionState>;
};

const OneSignalContext = createContext<OneSignalContextValue>({
  isReady: false,
  isSubscribed: false,
  subscriptionId: null,
  permission: "unsupported",
  pushCapable: false,
  pushCapableReason: null,
  pushEnvironment: "unknown",
  initError: null,
  promptPush: () => {},
  enableNotifications: async () => ({ optedIn: false, id: null, permission: "unsupported" }),
  refreshSubscription: async () => ({ optedIn: false, id: null, permission: "unsupported" }),
});

export function useOneSignal() {
  return useContext(OneSignalContext);
}

export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushCapable, setPushCapable] = useState(false);
  const [pushCapableReason, setPushCapableReason] = useState<string | null>(null);
  const [pushEnvironment, setPushEnvironment] = useState<PushEnvironment>("unknown");
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    setPermission(getBrowserPermission());
    setPushEnvironment(detectPushEnvironment());
    const native = isNativePushCapable();
    setPushCapable(native.capable);
    setPushCapableReason(native.reason);
  }, []);

  const applySubscription = useCallback((state: PushSubscriptionState) => {
    setIsSubscribed(state.optedIn);
    setSubscriptionId(state.id);
    setPermission(state.permission);
    return state;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const OneSignal = await getOneSignalClient();
        if (cancelled) return;

        OneSignal.User.PushSubscription.addEventListener("change", () => {
          applySubscription(readSubscriptionState(OneSignal));
        });

        applySubscription(readSubscriptionState(OneSignal));
        setInitError(null);
        setIsReady(true);

        const state = readSubscriptionState(OneSignal);
        if (state.permission === "granted" && !state.optedIn) {
          void enableBrowserPush().then((result) => {
            if (cancelled) return;
            if (result.error) {
              setInitError(result.error);
            } else {
              setInitError(null);
            }
            applySubscription(result.state);
          });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "OneSignal failed to initialize";
        setInitError(message);
        setPermission(getBrowserPermission());
        console.error("[OneSignal] Bootstrap failed:", error);
      }
    }

    function onReady() {
      void bootstrap();
    }

    function onInitError(event: Event) {
      if (cancelled) return;
      const detail = (event as CustomEvent<string>).detail;
      setInitError(detail || "OneSignal failed to initialize");
      setPermission(getBrowserPermission());
      console.error("[OneSignal] Init error event:", detail);
    }

    if (window.__oneSignalReady && window.__OneSignalInstance) {
      void bootstrap();
    } else if (window.__oneSignalInitError) {
      setInitError(window.__oneSignalInitError);
      setPermission(getBrowserPermission());
    } else {
      window.addEventListener("onesignal-ready", onReady);
      window.addEventListener("onesignal-init-error", onInitError);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("onesignal-ready", onReady);
      window.removeEventListener("onesignal-init-error", onInitError);
    };
  }, [applySubscription]);

  const refreshSubscription = useCallback(async () => {
    try {
      const OneSignal = await getOneSignalClient();
      return applySubscription(readSubscriptionState(OneSignal));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh subscription";
      setInitError(message);
      return applySubscription({
        optedIn: false,
        id: null,
        permission: getBrowserPermission(),
      });
    }
  }, [applySubscription]);

  const enableNotifications = useCallback(async () => {
    try {
      const result = await enableBrowserPush();
      if (result.error) {
        setInitError(result.error);
        console.warn("[OneSignal] Enable incomplete:", result.error, result.diagnostics);
      } else {
        setInitError(null);
      }
      setIsReady(true);
      const state = applySubscription(result.state);
      return {
        ...state,
        ...(result.error ? { error: result.error } : {}),
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to enable notifications";
      setInitError(message);
      console.error("[OneSignal] Enable failed:", error);
      const state = applySubscription({
        optedIn: false,
        id: null,
        permission: getBrowserPermission(),
      });
      return { ...state, error: message };
    }
  }, [applySubscription]);

  const promptPush = useCallback(() => {
    void enableNotifications();
  }, [enableNotifications]);

  return (
    <OneSignalContext.Provider
      value={{
        isReady,
        isSubscribed,
        subscriptionId,
        permission,
        pushCapable,
        pushCapableReason,
        pushEnvironment,
        initError,
        promptPush,
        enableNotifications,
        refreshSubscription,
      }}
    >
      {children}
    </OneSignalContext.Provider>
  );
}
