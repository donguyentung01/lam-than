/* The paid half of the bank, handed out only against a live pass.

   GET /api/cards?k=LT-XXXX-XXXX
     -> { ok:true, until:{deck:ms}, topics:{id:[...]}, tod:{id:{truths,dares}} }
     -> 403 { ok:false, reason } for the UI to explain

   A pass opens every paid deck, so a live one gets the whole bank. `until` is still given
   per deck, all with the same time, because that is the shape the page reads. */

import { BANK } from "./_bank.js";
import { check } from "./_pass.js";
import { configured, caller, overLimit } from "./_redis.js";

/* A table of six on one wifi shares an address, and each of them asks once or twice a
   session, so the ceiling sits well above honest use. It exists to stop a loop, not to
   ration anybody. */
const LIMIT = 60, WINDOW = 90;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");        // never let a CDN hold paid content
  if (req.method !== "GET") return res.status(405).json({ ok: false, reason: "method" });
  if (!configured) return res.status(503).json({ ok: false, reason: "unconfigured" });

  const { k = "" } = req.query || {};
  try {
    // this comes first: a wrong code costs a Redis read too, so refusing late still pays
    if (await overLimit(caller(req), { limit: LIMIT, seconds: WINDOW, bucket: "rl:cards" })) {
      res.setHeader("Retry-After", String(WINDOW));
      return res.status(429).json({ ok: false, reason: "too_fast" });
    }

    const seat = await check(k);
    if (!seat.ok) return res.status(403).json(seat);

    const topics = {}, tod = {}, until = {};
    for (const [id, cards] of Object.entries(BANK.topics)) if (cards.length) { topics[id] = cards; until[id] = seat.until; }
    for (const [id, deck] of Object.entries(BANK.tod)) { tod[id] = deck; until[id] = seat.until; }
    return res.status(200).json({ ok: true, code: seat.code, until, topics, tod });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: "error" });
  }
}
