const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";

export function OneSignalHead() {
  if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === "YOUR_ONESIGNAL_APP_ID") {
    return null;
  }

  // Must run synchronously in <head> BEFORE the SDK script — Next.js afterInteractive is too late on mobile.
  const bootstrapScript = `
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.init({
          appId: "${ONESIGNAL_APP_ID}",
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
        });
        window.__OneSignalInstance = OneSignal;
        window.__oneSignalReady = true;
        window.dispatchEvent(new CustomEvent("onesignal-ready"));
        console.log("[OneSignal] SDK ready");
      } catch (error) {
        const message = error && error.message ? error.message : "OneSignal init failed";
        window.__oneSignalInitError = message;
        window.dispatchEvent(new CustomEvent("onesignal-init-error", { detail: message }));
        console.error("[OneSignal] init failed:", error);
      }
    });
  `;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer />
    </>
  );
}
