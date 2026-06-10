import { env } from "../config.js";

function onesignalConfig() {
  return {
    appId: process.env.ONESIGNAL_APP_ID ?? env.onesignalAppId,
    restApiKey: process.env.ONESIGNAL_REST_API_KEY ?? env.onesignalRestApiKey,
  };
}

type SendPushInput = {
  title: string;
  message: string;
  subscriptionId?: string;
  url?: string;
};

type OneSignalResponse = {
  id?: string;
  errors?: string[];
};

export function isOneSignalConfigured(): boolean {
  const { appId, restApiKey } = onesignalConfig();
  return Boolean(appId && restApiKey);
}

export async function sendPushNotification(input: SendPushInput): Promise<OneSignalResponse> {
  const { appId, restApiKey } = onesignalConfig();

  if (!appId || !restApiKey) {
    throw new Error("OneSignal is not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in .env.local");
  }

  const body: Record<string, unknown> = {
    app_id: appId,
    headings: { en: input.title },
    contents: { en: input.message },
    chrome_web_icon: `${env.appOrigin}/icon-192.png`,
  };

  if (input.url) {
    body.url = input.url;
  }

  if (input.subscriptionId) {
    body.include_subscription_ids = [input.subscriptionId];
  } else {
    body.included_segments = ["Subscribed Users"];
  }

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${restApiKey}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as OneSignalResponse;

  if (!response.ok) {
    const detail = payload.errors?.join(", ") ?? `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}
