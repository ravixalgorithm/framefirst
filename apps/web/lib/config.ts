export const internalApiUrl = process.env.API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
export const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export const devSiteId = process.env.FRAMEFIRST_DEV_SITE_ID ?? "ff_dev_site";

export function scriptTagFor(siteId: string): string {
  return `<script src="${publicApiUrl}/track.js" data-site="${siteId}" async></script>`;
}
