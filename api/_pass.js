/* A pass is a bearer code: whoever holds it owns the decks on it, for 24 hours each, on up
   to six devices. There is no account and nothing to log in to. The device id counts slots
   and never grants anything on its own, so a copied device id without a code is worthless.

   Decks are bought one at a time and each carries its own clock, so buying a second deck at
   midnight neither extends the first nor shortens the second. One code holds them all, so
   the table still scans one QR however many decks the buyer owns. */

import { redis, NS } from "./_redis.js";

export const PRICE = 5000;            // đồng, per deck
const HOURS = 24;                     // how long one deck stays unlocked
const SHARE_MINUTES = 60;             // new devices may join for this long after a purchase
const MAX_DEVICES = 6;                // a table, not a group chat

const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";   // no 0/O, 1/I/L, 2/Z, 5/S, 8/B
const pick = n => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const newCode = () => `LT-${pick(4)}-${pick(4)}`;
export const newMemo = () => `LT${pick(6)}`;          // what the buyer's transfer note carries

const passKey = code => `${NS}pass:${code}`;
const deviceKey = code => `${NS}pass:${code}:devices`;

/* Codes are typed by hand off a screen, so be forgiving about case and stray spaces. */
export function tidyCode(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 10 && s.startsWith("LT") ? `LT-${s.slice(2, 6)}-${s.slice(6, 10)}` : "";
}

const read = raw => (typeof raw === "string" ? JSON.parse(raw) : raw);
export const liveDecks = (pass, now = Date.now()) =>
  Object.entries(pass.decks || {}).filter(([, until]) => until > now).map(([id]) => id);

async function save(code, pass) {
  const longest = Math.max(...Object.values(pass.decks), Date.now());
  const ttl = Math.ceil((longest - Date.now()) / 1000) + 3600;
  await redis("SET", passKey(code), JSON.stringify(pass), "EX", String(ttl));
  await redis("EXPIRE", deviceKey(code), String(ttl));
  return pass;
}

/* Add a deck to a code, or mint a new code when there is none yet. */
export async function grant(deck, existing = "", { hours = HOURS, note = "" } = {}) {
  const now = Date.now();
  const code = tidyCode(existing) || newCode();
  const raw = tidyCode(existing) ? await redis("GET", passKey(code)) : null;
  const pass = raw ? read(raw) : { createdAt: now, decks: {} };

  pass.decks[deck] = now + hours * 3600e3;    // this deck's own clock starts now
  pass.openUntil = now + SHARE_MINUTES * 60e3; // the table may have changed, so reopen sharing
  delete pass.revoked;
  if (note) pass.note = note;

  await save(code, pass);
  return { code, ...pass };
}

/* The one question the paywall asks. Returns a reason the UI can put into Vietnamese. */
export async function check(code, device) {
  const clean = tidyCode(code);
  if (!clean || !device) return { ok: false, reason: "invalid" };

  const raw = await redis("GET", passKey(clean));
  if (!raw) return { ok: false, reason: "invalid" };

  const pass = read(raw);
  if (pass.revoked) return { ok: false, reason: "invalid" };

  const now = Date.now();
  const decks = liveDecks(pass, now);
  if (!decks.length) return { ok: false, reason: "expired" };

  const known = Number(await redis("SISMEMBER", deviceKey(clean), device)) === 1;
  if (!known) {
    // a new device: the table gathers at once, so the door closes an hour after the purchase
    if (now > (pass.openUntil || 0)) return { ok: false, reason: "window_closed" };
    if (Number(await redis("SCARD", deviceKey(clean))) >= MAX_DEVICES) return { ok: false, reason: "too_many" };
    await redis("SADD", deviceKey(clean), device);
    await save(clean, pass);
  }
  return { ok: true, code: clean, decks, until: pass.decks, joined: !known };
}
