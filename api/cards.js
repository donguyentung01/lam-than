/* The paid half of the bank, handed out only against a live pass.

   GET /api/cards?k=LT-XXXX-XXXX&d=<device>
     -> { ok:true, until:{deck:ms}, topics:{id:[...]}, tod:{id:{truths,dares}} }
     -> 403 { ok:false, reason } for the UI to explain

   Only decks the pass actually owns come back, so a code for one deck cannot read another. */

import { BANK } from "./_bank.js";
import { check } from "./_pass.js";
import { configured } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");        // never let a CDN hold paid content
  if (req.method !== "GET") return res.status(405).json({ ok: false, reason: "method" });
  if (!configured) return res.status(503).json({ ok: false, reason: "unconfigured" });

  const { k = "", d = "" } = req.query || {};
  try {
    const seat = await check(k, String(d).slice(0, 64));
    if (!seat.ok) return res.status(403).json(seat);

    const topics = {}, tod = {};
    for (const id of seat.decks) {
      if (BANK.topics[id]?.length) topics[id] = BANK.topics[id];
      if (BANK.tod[id]) tod[id] = BANK.tod[id];
    }
    return res.status(200).json({ ok: true, code: seat.code, until: seat.until, topics, tod });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: "error" });
  }
}
