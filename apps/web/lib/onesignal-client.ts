import type { PushSubscriptionState } from "../components/onesignal-provider";

type OneSignalClient = {
  User: {
    PushSubscription: {
      optedIn: boolean;
      id: string | null;
      token: string | null;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener: (event: string, handler: () => void) => void;
    };
  };
  Notifications: {
    requestPermission: () => Promise<boolean>;
    permission: boolean;
    permissionNative: NotificationPermission;
    isPushSupported: () => boolean;
  };
};

export type PushDiagnostics = {
  pushSupported: boolean;
  permission: NotificationPermission | "unsupported";
  serviceWorkerReady: boolean;
  serviceWorkerScope: string | null;
  browserPushEndpoint: string | null;
  optedIn: boolean;
  subscriptionId: string | null;
  token: string | null;
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => void | Promise<void>>;
    __OneSignalInstance?: OneSignalClient;
    __oneSignalReady?: boolean;
    __oneSignalInitError?: string;
  }
}

export type PushEnvironment =
  | "android-chrome"
  | "android-other"
  | "ios-standalone"
  | "ios-browser"
  | "desktop"
  | "unknown";

export function detectPushEnvironment(): PushEnvironment {
  if (typeof window === "undefined") {
    return "unknown";
  }

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  if (isIOS) {
    return isStandalone ? "ios-standalone" : "ios-browser";
  }

  if (/Android/i.test(ua)) {
    return /Chrome/i.test(ua) ? "android-chrome" : "android-other";
  }

  return "desktop";
}

export function isNativePushCapable(): { capable: boolean; reason: string | null } {
  if (typeof window === "undefined") {
    return { capable: false, reason: "Push is only available in the browser." };
  }

  if (!window.isSecureContext) {
    return { capable: false, reason: "Open this page over HTTPS (your ngrok URL), not HTTP." };
  }

  const environment = detectPushEnvironment();
  if (environment === "ios-browser") {
    return {
      capable: false,
      reason:
        "iPhone Chrome/Firefox cannot receive web push. Open this URL in Safari → Share → Add to Home Screen, then open the app from your home screen.",
    };
  }

  if (!("serviceWorker" in navigator)) {
    return { capable: false, reason: "Service workers are not available in this browser." };
  }

  if (!("PushManager" in window)) {
    return { capable: false, reason: "This browser does not expose the Push API needed for web push." };
  }

  if (!("Notification" in window)) {
    return { capable: false, reason: "The Notification API is not available in this browser context." };
  }

  return { capable: true, reason: null };
}

export function getBrowserPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function readSubscriptionState(OneSignal: OneSignalClient): PushSubscriptionState {
  return {
    optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
    id: OneSignal.User.PushSubscription.id ?? null,
    permission: getBrowserPermission(),
  };
}

export async function getServiceWorkerDiagnostics(): Promise<{
  registrations: Array<{ scope: string; script: string; state: string }>;
  ready: boolean;
  readyScope: string | null;
  browserPushEndpoint: string | null;
}> {
  const registrations: Array<{ scope: string; script: string; state: string }> = [];
  let ready = false;
  let readyScope: string | null = null;
  let browserPushEndpoint: string | null = null;

  if ("serviceWorker" in navigator) {
    try {
      const all = await navigator.serviceWorker.getRegistrations();
      for (const registration of all) {
        const script =
          registration.active?.scriptURL ??
          registration.installing?.scriptURL ??
          registration.waiting?.scriptURL ??
          "unknown";
        const state =
          registration.active?.state ??
          registration.installing?.state ??
          registration.waiting?.state ??
          "none";
        registrations.push({ scope: registration.scope, script, state });
      }

      const registration = await navigator.serviceWorker.ready;
      ready = Boolean(registration);
      readyScope = registration.scope;
      const browserSubscription = await registration.pushManager.getSubscription();
      browserPushEndpoint = browserSubscription?.endpoint ?? null;
    } catch {
      // Ignore SW probe errors in diagnostics
    }
  }

  return { registrations, ready, readyScope, browserPushEndpoint };
}

export async function getPushDiagnostics(OneSignal: OneSignalClient): Promise<PushDiagnostics> {
  const sw = await getServiceWorkerDiagnostics();
  const serviceWorkerReady = sw.ready;
  const serviceWorkerScope = sw.readyScope;
  const browserPushEndpoint = sw.browserPushEndpoint;

  return {
    pushSupported: OneSignal.Notifications.isPushSupported(),
    permission: getBrowserPermission(),
    serviceWorkerReady,
    serviceWorkerScope,
    browserPushEndpoint,
    optedIn: Boolean(OneSignal.User.PushSubscription.optedIn),
    subscriptionId: OneSignal.User.PushSubscription.id ?? null,
    token: OneSignal.User.PushSubscription.token ?? null,
  };
}

export async function getOneSignalClient(): Promise<OneSignalClient> {
  if (typeof window === "undefined") {
    throw new Error("OneSignal is only available in the browser");
  }

  if (window.__OneSignalInstance) {
    return window.__OneSignalInstance;
  }

  if (window.__oneSignalReady) {
    throw new Error("OneSignal reported ready but no instance was stored");
  }

  return await new Promise<OneSignalClient>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("onesignal-ready", onReady);
      reject(new Error("OneSignal SDK did not finish loading. Refresh the page and try again."));
    }, 15000);

    function onReady() {
      window.clearTimeout(timeout);
      if (window.__OneSignalInstance) {
        resolve(window.__OneSignalInstance);
        return;
      }
      reject(new Error("OneSignal ready event fired without an SDK instance"));
    }

    window.addEventListener("onesignal-ready", onReady, { once: true });

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      window.clearTimeout(timeout);
      window.removeEventListener("onesignal-ready", onReady);
      window.__OneSignalInstance = OneSignal;
      resolve(OneSignal);
    });
  });
}

export async function verifyWorkerScriptAccessible(): Promise<{ ok: boolean; reason: string | null }> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Worker check only runs in the browser." };
  }

  try {
    const response = await fetch(`${window.location.origin}/OneSignalSDKWorker.js`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = await response.text();

    if (body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html")) {
      return {
        ok: false,
        reason:
          "ngrok is returning its warning page instead of the service worker. Open the ngrok URL in Chrome, tap Visit Site on the warning, refresh, then try again. For reliable push testing, use cloudflared instead of ngrok.",
      };
    }

    if (!response.ok || !body.includes("importScripts")) {
      return {
        ok: false,
        reason: `Service worker file is not reachable (HTTP ${response.status}).`,
      };
    }

    return { ok: true, reason: null };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not fetch the service worker file.",
    };
  }
}

async function ensureOneSignalServiceWorkerRegistered(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser");
  }

  const workerUrl = new URL("/OneSignalSDKWorker.js", window.location.origin).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const alreadyRegistered = registrations.some((registration) => {
    const script =
      registration.active?.scriptURL ??
      registration.installing?.scriptURL ??
      registration.waiting?.scriptURL ??
      "";
    return script.includes("OneSignalSDKWorker.js");
  });

  if (!alreadyRegistered) {
    await navigator.serviceWorker.register(workerUrl, { scope: "/" });
  }

  await waitForServiceWorkerReady(15000);
}

async function clearLegacyServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  let removed = false;

  for (const registration of registrations) {
    const scriptUrl =
      registration.active?.scriptURL ??
      registration.installing?.scriptURL ??
      registration.waiting?.scriptURL ??
      "";

    if (scriptUrl.includes("/sw.js")) {
      await registration.unregister();
      removed = true;
      console.log("[OneSignal] Unregistered legacy /sw.js service worker");
    }
  }

  return removed;
}

async function waitForServiceWorkerReady(timeoutMs = 10000): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser");
  }

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Service worker did not become ready")), timeoutMs);
    }),
  ]);
}

async function waitForSubscriptionId(
  OneSignal: OneSignalClient,
  attempts = 30
): Promise<PushSubscriptionState> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const state = readSubscriptionState(OneSignal);
    if (state.id && state.optedIn) {
      return state;
    }

    const diagnostics = await getPushDiagnostics(OneSignal);
    if (diagnostics.browserPushEndpoint && diagnostics.optedIn) {
      return state;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }

  return readSubscriptionState(OneSignal);
}

export async function enableBrowserPush(): Promise<{
  state: PushSubscriptionState;
  diagnostics: PushDiagnostics;
  error?: string;
}> {
  const native = isNativePushCapable();
  if (!native.capable) {
    return {
      state: { optedIn: false, id: null, permission: getBrowserPermission() },
      diagnostics: {
        pushSupported: false,
        permission: getBrowserPermission(),
        serviceWorkerReady: false,
        serviceWorkerScope: null,
        browserPushEndpoint: null,
        optedIn: false,
        subscriptionId: null,
        token: null,
      },
      error: native.reason ?? "Push notifications are not supported in this browser.",
    };
  }

  const OneSignal = await getOneSignalClient();

  if (!OneSignal.Notifications.isPushSupported()) {
    console.warn("[OneSignal] isPushSupported() is false but native push APIs exist — continuing anyway.");
  }

  if (Notification.permission === "default") {
    await OneSignal.Notifications.requestPermission();
  }

  if (Notification.permission === "denied") {
    const diagnostics = await getPushDiagnostics(OneSignal);
    return {
      state: readSubscriptionState(OneSignal),
      diagnostics,
      error: "Notifications are blocked in browser settings.",
    };
  }

  const workerCheck = await verifyWorkerScriptAccessible();
  if (!workerCheck.ok) {
    const diagnostics = await getPushDiagnostics(OneSignal);
    return {
      state: readSubscriptionState(OneSignal),
      diagnostics,
      error: workerCheck.reason ?? "Service worker file is not accessible.",
    };
  }

  const removedLegacyWorker = await clearLegacyServiceWorker();
  if (removedLegacyWorker) {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }

  try {
    await ensureOneSignalServiceWorkerRegistered();
  } catch (error) {
    const diagnostics = await getPushDiagnostics(OneSignal);
    return {
      state: readSubscriptionState(OneSignal),
      diagnostics,
      error:
        removedLegacyWorker
          ? "Removed an old service worker. Refresh this page once, then tap Enable again."
          : error instanceof Error
            ? `${error.message}. If you use ngrok free, tap Visit Site on its warning page first, then refresh.`
            : "Service worker failed to register.",
    };
  }

  try {
    if (!OneSignal.User.PushSubscription.optedIn) {
      await OneSignal.User.PushSubscription.optIn();
    }
  } catch (error) {
    const diagnostics = await getPushDiagnostics(OneSignal);
    return {
      state: readSubscriptionState(OneSignal),
      diagnostics,
      error: error instanceof Error ? `OneSignal opt-in failed: ${error.message}` : "OneSignal opt-in failed.",
    };
  }

  const state = await waitForSubscriptionId(OneSignal);
  const diagnostics = await getPushDiagnostics(OneSignal);

  if (!state.id) {
    return {
      state,
      diagnostics,
      error: removedLegacyWorker
        ? "Removed an old service worker. Refresh this page once, then tap Enable again."
        : diagnostics.browserPushEndpoint
          ? "Browser push is active but OneSignal has not assigned a subscription ID yet. Wait 10 seconds and tap Enable again."
          : "Permission granted but push registration did not complete. Clear site data, refresh, and try again. Also confirm your ngrok URL is set as the OneSignal Web Site URL.",
    };
  }

  return { state, diagnostics };
}
