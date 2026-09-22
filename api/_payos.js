/* payOS: create a payment link, and verify what comes back.

   Signatures follow payos.vn/docs. Creating a link signs a fixed field list in alphabetical
   order; a webhook signs its whole `data` object, keys sorted, nulls as empty strings.
   Both are HMAC-SHA256 hex with the channel's checksum key. */

import crypto from "node:crypto";

const CLIENT = process.env.PAYOS_CLIENT_ID;
const APIKEY = process.env.PAYOS_API_KEY;
const CHECKSUM = process.env.PAYOS_CHECKSUM_KEY;
const BASE = "https://api-merchant.payos.vn/v2/payment-requests";

export const payosReady = Boolean(CLIENT && APIKEY && CHECKSUM);

const hmac = data => crypto.createHmac("sha256", CHECKSUM).update(data).digest("hex");

/* The five fields payOS signs when a link is created, in the order its docs give. */
const createSignature = ({ amount, cancelUrl, description, orderCode, returnUrl }) =>
  hmac(`amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`);

/* A webhook signs its data object: keys sorted, null and the strings "null"/"undefined"
   flattened to empty, arrays JSON encoded with their own keys sorted. */
function webhookSignature(data) {
  const keys = Object.keys(data).sort();
  const parts = keys.map(k => {
    let v = data[k];
    if (v === null || v === undefined || v === "null" || v === "undefined") v = "";
    else if (Array.isArray(v)) {
      v = JSON.stringify(v.map(el => (el && typeof el === "object"
        ? Object.fromEntries(Object.keys(el).sort().map(kk => [kk, el[kk]]))
        : el)));
    }
    return `${k}=${v}`;
  });
  return hmac(parts.join("&"));
}

/* Constant-time compare, so a wrong signature cannot be found a byte at a time. */
export function verifyWebhook(body) {
  if (!payosReady || !body || !body.data || typeof body.signature !== "string") return false;
  const mine = Buffer.from(webhookSignature(body.data));
  const theirs = Buffer.from(body.signature);
  return mine.length === theirs.length && crypto.timingSafeEqual(mine, theirs);
}

export async function createLink({ orderCode, amount, description, returnUrl, cancelUrl, expiredAt }) {
  const payload = { orderCode, amount, description, returnUrl, cancelUrl };
  const body = { ...payload, expiredAt, signature: createSignature(payload) };
  const r = await fetch(BASE, {
    method: "POST",
    headers: { "x-client-id": CLIENT, "x-api-key": APIKEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await r.json();
  if (out.code !== "00" || !out.data) throw new Error(`payos ${out.code}: ${out.desc}`);
  return out.data;                       // checkoutUrl, qrCode, paymentLinkId, status, ...
}

/* Used to settle an order when the webhook was missed: payOS is the authority, not us. */
export async function readLink(orderCode) {
  const r = await fetch(`${BASE}/${orderCode}`, { headers: { "x-client-id": CLIENT, "x-api-key": APIKEY } });
  const out = await r.json();
  return out.code === "00" ? out.data : null;
}
