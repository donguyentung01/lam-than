/* Shared "cards flipped" counter.
   GET  /api/count              -> { total, topics: {yeu: n, ...} }
   POST /api/count {n, topic}   -> { total } after adding n (1..5) to the total and to that topic
   Storage: Upstash Redis REST (env vars set by the Vercel marketplace integration).
   With no database configured it answers { enabled:false } and the page hides the line. */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "cards:flipped";
const BY_TOPIC = "cards:by-topic";     // hash, one field per topic id
const TOPICS = ["yeu", "triet", "ay", "tien", "nha", "ban", "doi", "viec"];
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

function asTopics(flat) {                // HGETALL comes back as [field, value, field, value, ...]
  const out = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Number(flat[i + 1]) || 0;
  else if (flat && typeof flat === "object") for (const k of Object.keys(flat)) out[k] = Number(flat[k]) || 0;
  return out;
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(200).json({ enabled: false });
  try {
    if (req.method === "GET") {
      const [total, flat] = await Promise.all([redis("GET", KEY), redis("HGETALL", BY_TOPIC)]);
      // cached at the edge, so many pollers share one answer and the database sees ~20 reads a minute
      res.setHeader("Cache-Control", "public, s-maxage=3, stale-while-revalidate=30");
      // read-only and already public, so any page may show the number (the portfolio does)
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ enabled: true, total: Number(total) || 0, topics: asTopics(flat) });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const n = Math.min(5, Math.max(1, Math.floor(Number(body.n) || 1)));
      const topic = TOPICS.includes(body.topic) ? body.topic : null;
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const bucket = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
      const used = Number(await redis("INCRBY", bucket, String(n))) || 0;
      if (used === n) await redis("EXPIRE", bucket, "90");
      if (used > LIMIT_PER_MINUTE) {
        const total = Number(await redis("GET", KEY)) || 0;
        return res.status(200).json({ enabled: true, total, counted: false });
      }
      const [total] = await Promise.all([
        redis("INCRBY", KEY, String(n)),
        topic ? redis("HINCRBY", BY_TOPIC, topic, String(n)) : Promise.resolve(null),
      ]);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ enabled: true, total: Number(total) || 0, counted: true });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(200).json({ enabled: false });
  }
}
