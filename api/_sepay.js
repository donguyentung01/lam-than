/* SePay watches the bank account and POSTs here when money lands.

   It is a thinner thing than a payment gateway. There is no order, no redirect and no
   signature: the only link between a payment and a buyer is the memo their bank carries,
   and the only proof the POST is real is a shared key in the Authorization header. Both of
   those are handled here so the handlers can stay about entitlement. */

import crypto from "node:crypto";

const KEY = process.env.SEPAY_WEBHOOK_KEY;
const ACCOUNT = process.env.SEPAY_ACCOUNT;
const BANK = process.env.SEPAY_BANK;

export const sepayReady = Boolean(KEY && ACCOUNT && BANK);

/* The header arrives as "Apikey <key>". Bearer and a bare key are accepted too, because a
   change at their end should not silently reject every payment for a day. */
export function verifyKey(req) {
  if (!KEY) return false;
  const raw = String((req.headers || {}).authorization || "");
  const given = raw.replace(/^(Apikey|Bearer|Token)\s+/i, "").trim();
  const mine = Buffer.from(KEY), theirs = Buffer.from(given);
  return mine.length === theirs.length && crypto.timingSafeEqual(mine, theirs);
}

/* Banks rewrite the transfer note on the way through: they uppercase it, drop the diacritics
   and put their own reference in front, so "LTK7PQRW" arrives inside something like
   "CT DEN:092847 LTK7PQRW NGUYEN VAN A". Strip it to letters and digits and look inside. */
export const normalise = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* Every memo we mint. Returned longest-first so a stray prefix cannot shadow a real one. */
export function memosIn(content) {
  const found = normalise(content).match(/LT[ACDEFGHJKLMNPQRTUVWXY34679]{6}/g) || [];
  return [...new Set(found)];
}

/* The VietQR the buyer scans. SePay renders it, so there is no image to generate or host. */
export const qrUrl = (memo, amount) =>
  `https://qr.sepay.vn/img?acc=${encodeURIComponent(ACCOUNT)}&bank=${encodeURIComponent(BANK)}` +
  `&amount=${amount}&des=${encodeURIComponent(memo)}`;
