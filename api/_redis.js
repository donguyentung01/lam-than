/* Upstash Redis over REST, shared by every endpoint.
   Files under /api whose name starts with "_" are not routed, so this is never reachable. */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configured = Boolean(URL_ && TOKEN);

export async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

/* Preview deployments share one database with production, so passes minted while testing
   must not open the real site. Everything keyed through here is namespaced by environment. */
export const NS = process.env.VERCEL_ENV === "production" ? "" : "t:";
