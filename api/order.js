/* Buying one deck.

   POST /api/order { deck, code? }
     -> { ok, memo, qr, amount }           show the QR, then poll
     -> { ok, paid:true, code }            nothing configured outside production: the stub

   GET /api/order?o=<memo>
     -> { status:"pending" } | { status:"paid", code }

   The memo is the order id. It is the only thing tying a bank transfer back to the person
   waiting on a screen, which is why it is minted here and never taken from the client. A
   pass is minted only by the webhook, from money the bank actually received; nothing a
   browser sends can mint one. */

import { redis, configured, NS } from "./_redis.js";
import { grant, PRICE, newMemo } from "./_pass.js";
import { sepayReady, qrUrl } from "./_sepay.js";
import { BANK } from "./_bank.js";

const DEV = process.env.VERCEL_ENV !== "production";
const orderKey = memo => `${NS}order:${memo}`;
const TTL = "7200";                                   // two hours to finish paying

const knownDeck = id => id in BANK.topics || id in BANK.tod;

export async function readOrder(memo) {
  const raw = await redis("GET", orderKey(memo));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function settle(memo, { via = "" } = {}) {
  const order = await readOrder(memo);
  if (!order) return null;
  if (order.status === "paid") return order;          // already granted: idempotent

  const pass = await grant(order.deck, order.code, { note: via || `sepay:${memo}` });
  order.status = "paid";
  order.pass = pass.code;
  await redis("SET", orderKey(memo), JSON.stringify(order), "EX", TTL);
  return order;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!configured) return res.status(503).json({ ok: false, reason: "unconfigured" });

  if (req.method === "GET") {
    const o = String((req.query || {}).o || "").toUpperCase();
    if (!/^LT[A-Z0-9]{6}$/.test(o)) return res.status(400).json({ ok: false, reason: "bad_order" });
    const order = await readOrder(o);
    if (!order) return res.status(404).json({ ok: false, reason: "no_order" });
    return res.status(200).json(order.status === "paid"
      ? { ok: true, status: "paid", code: order.pass }
      : { ok: true, status: "pending" });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const deck = String(body.deck || "");
  if (!knownDeck(deck)) return res.status(400).json({ ok: false, reason: "unknown_deck" });

  const memo = newMemo();
  const order = { deck, code: String(body.code || ""), amount: PRICE, status: "pending" };

  try {
    if (!sepayReady) {
      // before the bank is wired up, test can still walk the whole flow; production cannot
      if (!DEV) return res.status(503).json({ ok: false, reason: "unconfigured" });
      await redis("SET", orderKey(memo), JSON.stringify(order), "EX", TTL);
      const settled = await settle(memo, { via: "stub" });
      return res.status(200).json({ ok: true, paid: true, code: settled.pass, memo });
    }

    await redis("SET", orderKey(memo), JSON.stringify(order), "EX", TTL);
    return res.status(200).json({ ok: true, memo, amount: PRICE, qr: qrUrl(memo, PRICE) });
  } catch (e) {
    return res.status(502).json({ ok: false, reason: "payment_unavailable" });
  }
}
