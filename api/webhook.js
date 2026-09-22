/* payOS calls this when money lands.

   It fires more than once for the same payment, and anyone can POST here, so: verify the
   signature first, trust only the order we stored for the amount, and make granting
   idempotent. payOS also posts a test event when the webhook is registered, which has no
   matching order and must answer 200 so registration succeeds. */

import { verifyWebhook, payosReady } from "./_payos.js";
import { readOrder, settle } from "./order.js";
import { configured } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false });
  if (!payosReady || !configured) return res.status(503).json({ success: false });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (!verifyWebhook(body)) return res.status(401).json({ success: false });

  const d = body.data || {};
  try {
    const order = await readOrder(String(d.orderCode));
    // an unknown order is payOS's registration ping, or a payment for something we forgot:
    // answer 200 either way so payOS stops retrying, and leave the money to be looked at
    if (!order) return res.status(200).json({ success: true, note: "no matching order" });
    // check what was actually paid before anything is granted
    if (Number(d.amount) !== Number(order.amount)) {
      return res.status(200).json({ success: true, note: "amount mismatch" });
    }
    await settle(String(d.orderCode));
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
}
