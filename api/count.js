/* Shared "cards flipped" counter.
   GET  /api/count        -> { total }
   POST /api/count {n}    -> { total } after adding n (1..5)
   Storage: Upstash Redis REST (env vars set by the Vercel marketplace integration).
   With no database configured it answers { enabled:false } and the page hides the line. */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "cards:flipped";
const LIMIT_PER_MINUTE = 300;          // per address, so one page cannot inflate the count much

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(200).json({ enabled: false });
  try {
    if (req.method === "GET") {
      const total = Number(await redis("GET", KEY)) || 0;
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
      return res.status(200).json({ enabled: true, total });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const n = Math.min(5, Math.max(1, Math.floor(Number(body.n) || 1)));
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const bucket = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
      const used = Number(await redis("INCRBY", bucket, String(n))) || 0;
      if (used === n) await redis("EXPIRE", bucket, "90");
      if (used > LIMIT_PER_MINUTE) {
        const total = Number(await redis("GET", KEY)) || 0;
        return res.status(200).json({ enabled: true, total, counted: false });
      }
      const total = Number(await redis("INCRBY", KEY, String(n))) || 0;
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ enabled: true, total, counted: true });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(200).json({ enabled: false });
  }
}
