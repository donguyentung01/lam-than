/* Shared "cards flipped" counter.
   GET  /api/count                     -> { total, topics: {yeu: n, ...} }
   POST /api/count {n, topic}          -> { total } after adding n to the total and that topic
   POST /api/count {items:[{topic,n}]} -> the same, for several topics at once

   The page buffers flips and sends one request for a handful of cards, because every POST
   is an uncacheable edge request while a card flip costs nothing.
   Storage: Upstash Redis REST (env vars set by the Vercel marketplace integration).
   With no database configured it answers { enabled:false } and the page hides the line. */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "cards:flipped";
const BY_TOPIC = "cards:by-topic";     // hash, one field per topic id
const TOPICS = ["yeu", "triet", "ay", "tien", "nha", "ban", "doi", "viec",
                "t-yeu", "t-ay"];   // the thật hay thách decks keep their own tallies
const LIMIT_PER_MINUTE = 300;          // per address, so one page cannot inflate the count much
const MAX_PER_ITEM = 20;               // a batch is a few cards of one topic, never a spike
const MAX_PER_CALL = 60;

/* Several commands in one HTTP request. Upstash still counts each command, but the page
   makes one call instead of two or three, which is fewer round trips and less to go wrong. */
async function pipeline(...cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  return out.map(x => x.result);
}

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
      const [total, flat] = await pipeline(["GET", KEY], ["HGETALL", BY_TOPIC]);
      // cached at the edge, so however many people are polling, each edge asks the database
      // once every ten seconds, and keeps serving the old number while it refreshes
      // max-age matters most: a hit in the browser never leaves the device, while a hit at
      // the edge is still a billed edge request. s-maxage keeps the database quiet as well.
      res.setHeader("Cache-Control", "public, max-age=25, s-maxage=10, stale-while-revalidate=60");
      // read-only and already public, so any page may show the number (the portfolio does)
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).json({ enabled: true, total: Number(total) || 0, topics: asTopics(flat) });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

      // one flip, or a batch of them: {n, topic} and {items:[{topic, n}]} both land here
      const raw = Array.isArray(body.items) && body.items.length
        ? body.items.slice(0, TOPICS.length + 1)
        : [{ topic: body.topic, n: body.n }];
      const items = [];
      for (const it of raw) {
        const each = Math.min(MAX_PER_ITEM, Math.max(1, Math.floor(Number(it && it.n) || 1)));
        items.push({ topic: TOPICS.includes(it && it.topic) ? it.topic : null, n: each });
      }
      const n = Math.min(MAX_PER_CALL, items.reduce((sum, it) => sum + it.n, 0));
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const bucket = `rl:${ip}:${Math.floor(Date.now() / 60000)}`;
      // the bucket key already carries the minute, so refreshing its TTL every time is free
      const [used] = await pipeline(["INCRBY", bucket, String(n)], ["EXPIRE", bucket, "90"]);
      if (Number(used) > LIMIT_PER_MINUTE) {
        const total = Number(await redis("GET", KEY)) || 0;
        return res.status(200).json({ enabled: true, total, counted: false });
      }
      const [total] = await pipeline(
        ["INCRBY", KEY, String(n)],
        ...items.filter(it => it.topic).map(it => ["HINCRBY", BY_TOPIC, it.topic, String(it.n)]),
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ enabled: true, total: Number(total) || 0, counted: true });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(200).json({ enabled: false });
  }
}
