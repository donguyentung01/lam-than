#!/usr/bin/env node
/* The bridge between the Question Inbox and src/app.html.

   The Inbox (a claude.ai artifact) is where questions are written and picked. It cannot
   touch this repo, so Claude reads its database and hands the decisions to this script.

     node tools/inbox.mjs export              every deck in the app, as JSON on stdout
     node tools/inbox.mjs apply changes.json  add, remove and reword cards in src/app.html

   changes.json:
     { "add":    [{ "game":"hoi"|"tod", "topic":"yeu", "kind":"truth"|"dare", "text":"…" }],
       "remove": [{ "game", "topic", "kind", "text" }],
       "edit":   [{ "game", "topic", "kind", "from":"old text", "to":"new text" }] }
   `kind` is only for thật hay thách cards.

   New cards go at the end of their deck, so the free cards at the top never shift.
   A remove or edit that cannot find its card stops everything before anything is written:
   it means the app and the Inbox disagree, and a person should look. */
import fs from "node:fs";

const FILE = new URL("../src/app.html", import.meta.url);
let page = fs.readFileSync(FILE, "utf8");

/* Find the [ … ] that follows `from`, counting brackets and skipping strings. */
function arrayAt(from) {
  const open = page.indexOf("[", from);
  let depth = 0, quote = null;
  for (let i = open; i < page.length; i++) {
    const c = page[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "`") quote = c;
    else if (c === "[") depth++;
    else if (c === "]" && !--depth) return { open, close: i };
  }
  throw new Error("unclosed array");
}
const listOf = name => { const at = page.indexOf(`const ${name} = [`); const a = arrayAt(at); return { ...a, value: eval(page.slice(a.open, a.close + 1)) }; };

/* Where one deck's cards live in the source: the cards / truths / dares array. */
function slot(game, topic, kind) {
  const list = listOf(game === "tod" ? "TOD" : "TOPICS");
  const head = page.indexOf(`{id:"${topic}"`, list.open);
  if (head < 0 || head > list.close) throw new Error(`no deck "${topic}" in ${game}`);
  const field = game === "tod" ? (kind === "dare" ? "dares:[" : "truths:[") : "cards:[";
  const at = page.indexOf(field, head);
  const a = arrayAt(at);
  return { ...a, cards: eval(page.slice(a.open, a.close + 1)) };
}

/* Straight quotes inside a card become curly, as everywhere else in the decks. */
const tidy = t => String(t).trim().replace(/\s+/g, " ").replace(/"([^"]*)"/g, "“$1”");
const same = (a, b) => a.normalize("NFC").trim() === b.normalize("NFC").trim();

/* Write a deck back in the house style: one card per line, indented like its neighbours. */
function write(s, cards) {
  const body = page.slice(s.open + 1, s.close);
  const indent = (/\n([ \t]+)"/.exec(body) || [, "  "])[1];
  const tail = (/\n([ \t]*)$/.exec(body) || [, ""])[1];
  const text = "\n" + cards.map(c => indent + JSON.stringify(c)).join(",\n") + "\n" + tail;
  page = page.slice(0, s.open + 1) + text + page.slice(s.close);
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "export") {
  const out = { hoi: {}, tod: {} };
  for (const t of listOf("TOPICS").value) out.hoi[t.id] = { name: t.name, sub: t.sub, adult: !!t.adult, cards: t.cards };
  for (const t of listOf("TOD").value) out.tod[t.id] = { name: t.name, sub: t.sub, adult: !!t.adult, truths: t.truths, dares: t.dares };
  console.log(JSON.stringify(out, null, 1));
} else if (cmd === "apply") {
  const ch = JSON.parse(fs.readFileSync(arg, "utf8"));
  const log = { add: 0, remove: 0, edit: 0, skipped: [] };
  const key = c => `${c.game}|${c.topic}|${c.kind || ""}`;
  const groups = new Map();
  const group = c => { if (!groups.has(key(c))) groups.set(key(c), { ...c, ops: [] }); return groups.get(key(c)).ops; };
  for (const c of ch.edit || []) group(c).push({ op: "edit", from: c.from, to: tidy(c.to) });
  for (const c of ch.remove || []) group(c).push({ op: "remove", text: c.text });
  for (const c of ch.add || []) group(c).push({ op: "add", text: tidy(c.text) });

  for (const g of groups.values()) {
    const s = slot(g.game, g.topic, g.kind);
    let cards = s.cards.slice();
    for (const o of g.ops) {
      if (o.op === "edit") {
        const i = cards.findIndex(c => same(c, o.from));
        if (i < 0) throw new Error(`edit: not in ${key(g)}: ${o.from}`);
        cards[i] = o.to; log.edit++;
      } else if (o.op === "remove") {
        const i = cards.findIndex(c => same(c, o.text));
        if (i < 0) throw new Error(`remove: not in ${key(g)}: ${o.text}`);
        cards.splice(i, 1); log.remove++;
      } else {
        if (cards.some(c => same(c, o.text))) { log.skipped.push(o.text); continue; }   // already there
        cards.push(o.text); log.add++;
      }
    }
    write(s, cards);
  }
  fs.writeFileSync(FILE, page);
  console.log(`added ${log.add}, removed ${log.remove}, reworded ${log.edit}` +
    (log.skipped.length ? `; ${log.skipped.length} already in the app` : ""));
} else {
  console.error("usage: node tools/inbox.mjs export | apply changes.json");
  process.exit(1);
}
