/* Payments the webhook could not match to an order.

   Someone will edit the transfer note, or pay twice, or send 5.000đ with no note at all.
   That money is owed and the webhook writes it down rather than dropping it. This reads the
   list, and grants a pass by hand when one turns out to be real.

     node tools/stranded.mjs                      what is waiting
     node tools/stranded.mjs --grant              mint a new code, open for 24 hours
     node tools/stranded.mjs --grant --code LT-ABCD-EFGH    reopen a code they have

   Add --prod to work on production; without it everything is the t: test namespace. */

import fs from "node:fs";

const env = Object.fromEntries(fs.readFileSync(new URL("../dbkey.txt", import.meta.url), "utf8")
  .split("\n").filter(l => l.includes("=")).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];   // values are quoted
  }));

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const PROD = process.argv.includes("--prod");
process.env.KV_REST_API_URL = env.KV_REST_API_URL;
process.env.KV_REST_API_TOKEN = env.KV_REST_API_TOKEN;
process.env.VERCEL_ENV = PROD ? "production" : "preview";

const { redis, NS } = await import("../api/_redis.js");
const { grant, tidyCode } = await import("../api/_pass.js");

const where = PROD ? "production" : "test";
const granting = process.argv.includes("--grant");

if (!granting) {
  const rows = (await redis("LRANGE", `${NS}unmatched`, "0", "-1")) || [];
  if (!rows.length) { console.log(`nothing stranded on ${where}`); process.exit(0); }
  console.log(`${rows.length} stranded on ${where}:\n`);
  for (const raw of rows) {
    const r = typeof raw === "string" ? JSON.parse(raw) : raw;
    const t = r.tx || {};
    console.log(`  ${new Date(r.at).toLocaleString("vi-VN")}  ${Number(t.transferAmount || 0).toLocaleString("vi-VN")}đ`);
    console.log(`    ${r.note}`);
    console.log(`    note: ${t.content || t.description || "(none)"}`);
    console.log(`    ref:  ${t.referenceCode || t.id || "?"}\n`);
  }
  console.log("to settle one:  node tools/stranded.mjs --grant [--code LT-XXXX-XXXX]" + (PROD ? " --prod" : ""));
  process.exit(0);
}

const existing = arg("--code") ? tidyCode(arg("--code")) : "";
if (arg("--code") && !existing) { console.error("that code is not the right shape"); process.exit(1); }

const pass = await grant(existing, { note: "granted by hand" });
console.log(`${where}: ${pass.code} is open until ${new Date(pass.until).toLocaleString("vi-VN")}`);
console.log(`share:     https://${PROD ? "lamthan.com" : "test.lamthan.com"}/#k=${pass.code}`);
