/* A pass is a bearer code: whoever holds it can play every paid deck for 24 hours.
   There is no account and nothing to log in to, and no limit on how many phones use it.
   Most people do not pass codes around, and the ones who do are a table of friends.

   One payment opens everything, so a pass is just a code and the moment it runs out.
   Paying again on a code you already hold starts a fresh 24 hours on that same code,
   so the friends who typed it in keep playing without typing anything new. */

import { redis, NS } from "./_redis.js";

export const PRICE = 5000;            // đồng, for every paid deck
const HOURS = 24;                     // how long a pass stays open

const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";   // no 0/O, 1/I/L, 2/Z, 5/S, 8/B
const pick = n => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const newCode = () => `LT-${pick(4)}-${pick(4)}`;
export const newMemo = () => `LT${pick(6)}`;          // what the buyer's transfer note carries

const passKey = code => `${NS}pass:${code}`;

/* Codes are typed by hand off a screen, so be forgiving about case and stray spaces. */
export function tidyCode(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 10 && s.startsWith("LT") ? `LT-${s.slice(2, 6)}-${s.slice(6, 10)}` : "";
}

const read = raw => (typeof raw === "string" ? JSON.parse(raw) : raw);

/* Open a code for 24 hours from now, or mint a new one when there is none yet. */
export async function grant(existing = "", { hours = HOURS, note = "" } = {}) {
  const now = Date.now();
  const code = tidyCode(existing) || newCode();
  const raw = tidyCode(existing) ? await redis("GET", passKey(code)) : null;
  const pass = raw ? read(raw) : { createdAt: now };

  pass.until = now + hours * 3600e3;
  delete pass.decks;                  // left over from when each deck had its own clock
  delete pass.revoked;
  if (note) pass.note = note;

  // keep the key an hour past expiry, so a late check says "expired" rather than "invalid"
  const ttl = Math.ceil((pass.until - now) / 1000) + 3600;
  await redis("SET", passKey(code), JSON.stringify(pass), "EX", String(ttl));
  return { code, ...pass };
}

/* The one question the paywall asks. Returns a reason the UI can put into Vietnamese. */
export async function check(code) {
  const clean = tidyCode(code);
  if (!clean) return { ok: false, reason: "invalid" };

  const raw = await redis("GET", passKey(clean));
  if (!raw) return { ok: false, reason: "invalid" };

  const pass = read(raw);
  if (pass.revoked) return { ok: false, reason: "invalid" };
  if (!(pass.until > Date.now())) return { ok: false, reason: "expired" };

  return { ok: true, code: clean, until: pass.until };
}
