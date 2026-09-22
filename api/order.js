/* Buying one deck.

   POST /api/order { deck, code? }
     -> { ok, orderCode, checkoutUrl }     send the buyer to payOS
     -> { ok, paid:true, code }            no payOS configured outside production: the stub

   GET /api/order?o=<orderCode>
     -> { status:"pending" } | { status:"paid", code }

   The pass is only ever minted from a payment payOS confirms, either through the webhook or
   through a read of the payment link here. Nothing a browser sends can mint one. */

import { redis, configured, NS } from "./_redis.js";
import { grant, PRICE } from "./_pass.js";
import { payosReady, createLink, readLink } from "./_payos.js";
import { BANK } from "./_bank.js";

const DEV = process.env.VERCEL_ENV !== "production";
const orderKey = o => `${NS}order:${o}`;
const TTL = "7200";                                   // two hours to finish paying

const knownDeck = id => id in BANK.topics || id in BANK.tod;
const origin = req => {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
};

export async function readOrder(orderCode) {
  const raw = await redis("GET", orderKey(orderCode));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function settle(orderCode) {
  const order = await readOrder(orderCode);
  if (!order) return null;
  if (order.status === "paid") return order;          // already granted: idempotent

  const pass = await grant(order.deck, order.code, { note: `payos:${orderCode}` });
  order.status = "paid";
  order.pass = pass.code;
  await redis("SET", orderKey(orderCode), JSON.stringify(order), "EX", TTL);
  return order;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!configured) return res.status(503).json({ ok: false, reason: "unconfigured" });

  if (req.method === "GET") {
    const o = String((req.query || {}).o || "");
    if (!/^\d+$/.test(o)) return res.status(400).json({ ok: false, reason: "bad_order" });
    const raw = await redis("GET", orderKey(o));
    if (!raw) return res.status(404).json({ ok: false, reason: "no_order" });
    let order = typeof raw === "string" ? JSON.parse(raw) : raw;

    // the webhook usually lands first, but never rely on it: ask payOS directly
    if (order.status !== "paid" && payosReady) {
      const link = await readLink(o).catch(() => null);
      if (link && link.status === "PAID") order = (await settle(o)) || order;
    }
    return res.status(200).json(order.status === "paid"
      ? { ok: true, status: "paid", code: order.pass }
      : { ok: true, status: order.status || "pending" });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const deck = String(body.deck || "");
  if (!knownDeck(deck)) return res.status(400).json({ ok: false, reason: "unknown_deck" });

  const orderCode = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);
  const order = { deck, code: String(body.code || ""), amount: PRICE, status: "pending" };

  try {
    if (!payosReady) {
      // before payOS is wired up, test can still walk the whole flow; production cannot
      if (!DEV) return res.status(503).json({ ok: false, reason: "unconfigured" });
      await redis("SET", orderKey(orderCode), JSON.stringify(order), "EX", TTL);
      const settled = await settle(orderCode);
      return res.status(200).json({ ok: true, paid: true, code: settled.pass, orderCode });
    }

    await redis("SET", orderKey(orderCode), JSON.stringify(order), "EX", TTL);
    const back = `${origin(req)}/?o=${orderCode}`;
    const link = await createLink({
      orderCode,
      amount: PRICE,
      description: `lam than ${deck}`.slice(0, 25),     // this lands in the buyer's bank memo
      returnUrl: back,
      cancelUrl: back,
      expiredAt: Math.floor(Date.now() / 1000) + 3600,
    });
    return res.status(200).json({ ok: true, orderCode, checkoutUrl: link.checkoutUrl });
  } catch (e) {
    return res.status(502).json({ ok: false, reason: "payment_unavailable" });
  }
}
