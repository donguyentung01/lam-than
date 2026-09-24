/* SePay calls this when money lands in the account.

   Three things have to be true of it, because all three will be tested by reality rather
   than by good intentions: anyone can POST here, so the key is checked before anything else
   is touched; it fires more than once for the same payment, so granting is idempotent on
   SePay's transaction id; and a buyer can mistype the memo, so a payment we cannot match is
   money we still owe somebody and gets written down rather than dropped. */

import { verifyKey, sepayReady, memosIn } from "./_sepay.js";
import { readOrder, settle } from "./order.js";
import { redis, configured, NS } from "./_redis.js";

const seenKey = id => `${NS}seen:${id}`;
const UNMATCHED = `${NS}unmatched`;

/* Stranded money, kept where it can be read and granted by hand. */
async function park(note, tx) {
  try {
    await redis("RPUSH", UNMATCHED, JSON.stringify({ note, at: Date.now(), tx }));
    await redis("LTRIM", UNMATCHED, "-200", "-1");
    await redis("EXPIRE", UNMATCHED, "2592000");          // thirty days
  } catch (e) { /* never let bookkeeping fail the payment */ }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false });
  if (!verifyKey(req)) return res.status(401).json({ success: false });   // before any work
  if (!sepayReady || !configured) return res.status(503).json({ success: false });

  const d = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  // money out is none of our business, and SePay is told so, but never trust the filter
  if (d.transferType && d.transferType !== "in") return res.status(200).json({ success: true });

  const amount = Number(d.transferAmount || 0);
  const id = String(d.id || d.referenceCode || "");
  if (!id) return res.status(200).json({ success: true, note: "no id" });

  try {
    // the same transaction arriving twice must not grant twice, nor be parked twice
    const first = await redis("SET", seenKey(id), "1", "NX", "EX", "604800");
    if (first === null) return res.status(200).json({ success: true, note: "already seen" });

    // SePay extracts the code itself when a prefix is configured; scan the note either way
    const candidates = [...new Set([...memosIn(d.code), ...memosIn(d.content || d.description)])];
    let order = null, memo = "";
    for (const m of candidates) {
      const o = await readOrder(m);
      if (o) { order = o; memo = m; break; }
    }
    if (!order) {
      await park("no matching order", d);
      return res.status(200).json({ success: true, note: "unmatched" });
    }
    // check what was actually paid before anything is granted
    if (amount < Number(order.amount)) {
      await park(`underpaid: ${amount} for ${order.amount}`, d);
      return res.status(200).json({ success: true, note: "underpaid" });
    }

    await settle(memo, { via: `sepay:${id}` });
    return res.status(200).json({ success: true });
  } catch (e) {
    // a 500 makes SePay retry, which is what we want for a blip on the Redis side
    return res.status(500).json({ success: false });
  }
}
