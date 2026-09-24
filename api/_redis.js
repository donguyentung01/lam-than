import { createHash } from "node:crypto";

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

/* Several commands in one HTTP round trip. */
export async function pipeline(...cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map(x => x.result);
}

/* A caller is whoever is on the other end of the socket, which is all we have without
   accounts. The address is hashed and given ninety seconds to live, so nothing that could
   identify anybody is ever written down: the bucket is a counter with a short memory. */
export function caller(req) {
  const fwd = String((req.headers || {})["x-forwarded-for"] || "");
  const ip = fwd.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/* True when this caller has gone over the limit. One round trip, and the window does not
   slide forward on every hit, so a burst cannot hold itself out forever. */
export async function overLimit(who, { limit, seconds, bucket = "rl" }) {
  const key = `${NS}${bucket}:${who}`;
  const [used] = await pipeline(["INCR", key], ["EXPIRE", key, String(seconds), "NX"]);
  return Number(used) > limit;
}
