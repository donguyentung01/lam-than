#!/usr/bin/env node
/* Làm Thân card renderer.
   Draws question cards and the promo card at 1080x1350 (4:5, what Threads wants)
   by laying them out in headless Chrome and screenshotting. No npm packages.

   node render.mjs --list
   node render.mjs --topic yeu --pick 4
   node render.mjs --q "có nên yêu xa?" --topic yeu
   node render.mjs --cta-only --theme trungthu
*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, "questions.json"), "utf8"));
const THEMES = JSON.parse(fs.readFileSync(path.join(HERE, "themes.json"), "utf8"));
const FONTS = fs.readFileSync(path.join(HERE, "fonts.css"), "utf8")
  .replace(/url\(fonts\//g, () => `url(${pathToFileURL(path.join(HERE, "fonts"))}/`);

function pathToFileURL(p) { return "file://" + p.split(path.sep).map(encodeURIComponent).join("/"); }

/* ---------- arguments ---------- */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? dflt : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true);
};
const has = name => argv.includes("--" + name);

const opt = {
  topic: arg("topic", "all"),
  pick: Number(arg("pick", 3)),
  q: arg("q", null),
  theme: String(arg("theme", "dongho")),
  out: String(arg("out", "./cards")),
  used: String(arg("used", "./used.txt")),
  seed: arg("seed", null),
  headline: arg("headline", "muốn hỏi thêm\nnhiều câu như vậy?"),
  body: arg("body", null),
  pill: arg("pill", "truy cập lamthan.com →"),
  foot: arg("foot", "lưu bài & ghé web mỗi ngày để có câu hỏi mới nhé"),
  adult: has("adult"),
  noCta: has("no-cta"),
  ctaOnly: has("cta-only"),
};

if (has("list")) {
  console.log(`${DATA.total} câu hỏi · ${DATA.topics.length} chủ đề · cập nhật ${DATA.updated}\n`);
  for (const t of DATA.topics) {
    console.log(`  ${t.id.padEnd(7)} ${t.name.padEnd(18)} ${String(t.cards.length).padStart(3)} câu${t.adult ? "   18+" : ""}`);
  }
  console.log(`\nthemes: ${Object.keys(THEMES).join(", ")}`);
  process.exit(0);
}

const theme = THEMES[opt.theme];
if (!theme) { console.error(`unknown theme "${opt.theme}" (have: ${Object.keys(THEMES).join(", ")})`); process.exit(1); }

/* ---------- picking ---------- */
let rand = Math.random;
if (opt.seed !== null) {                       // same seed, same cards, for reruns
  let s = [...String(opt.seed)].reduce((a, c) => a + c.charCodeAt(0) * 7919, 2166136261) >>> 0;
  rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const usedSet = new Set(
  fs.existsSync(opt.used) ? fs.readFileSync(opt.used, "utf8").split("\n").map(l => l.trim()).filter(Boolean) : []
);

function pool() {
  const topics = opt.topic === "all" ? DATA.topics : DATA.topics.filter(t => t.id === opt.topic);
  if (!topics.length) { console.error(`unknown topic "${opt.topic}" (try --list)`); process.exit(1); }
  const out = [];
  for (const t of topics) {
    if (t.adult && !opt.adult && opt.topic === "all") continue;   // 18+ only when asked for by name or --adult
    for (const text of t.cards) out.push({ topic: t, text });
  }
  return out;
}

function choose(n) {
  const all = pool();
  const fresh = all.filter(c => !usedSet.has(c.text));
  const from = fresh.length >= n ? fresh : all;
  if (fresh.length < n) console.warn(`! only ${fresh.length} unused left, reusing older ones`);
  const bag = [...from];
  const out = [];
  while (out.length < Math.min(n, bag.length)) out.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
  return out;
}

let cards;
if (opt.q) {
  const t = DATA.topics.find(x => x.id === opt.topic) || DATA.topics[0];
  cards = [{ topic: t, text: String(opt.q) }];
} else if (opt.ctaOnly) {
  cards = [];
} else {
  cards = choose(opt.pick);
}

/* ---------- the page ---------- */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function paper(bg, rule, alpha, shimmer) {
  return `<canvas id="paper" width="1080" height="1350"></canvas>
<script>
(function(){
  var g = document.getElementById("paper").getContext("2d"), W = 1080, H = 1350;
  g.fillStyle = ${JSON.stringify(bg)}; g.fillRect(0, 0, W, H);
  for (var i = 0; i < 3600; i++) {            // điệp shimmer, the fleck in the paper
    g.fillStyle = ${JSON.stringify(shimmer)}; g.globalAlpha = Math.random() * .6;
    g.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  var r = 16; g.lineWidth = 1.7; g.strokeStyle = ${JSON.stringify(rule)};
  for (var row = 0, y = 0; y < H + r; row++, y += r * .55) {   // sóng nước, the wave motif
    for (var x = (row % 2 ? r : 0) - r; x < W + r; x += r * 2) {
      g.globalAlpha = 1; g.fillStyle = ${JSON.stringify(bg)};
      g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.fill();
      g.globalAlpha = ${alpha};
      for (var k = r - 2; k > 2; k -= 4) { g.beginPath(); g.arc(x, y, k, Math.PI, 0); g.stroke(); }
    }
  }
})();
</script>`;
}

const BASE = `<style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body,body *{text-transform:lowercase}
#paper{position:absolute;inset:0}
.sheet{position:absolute;inset:0;display:flex;flex-direction:column}
</style>`;

function questionPage(card) {
  const [bg, ink] = theme.cards[card.topic.ci];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">${BASE}<style>
.sheet{padding:64px}
.card{flex:1;position:relative;border-radius:30px;background:${bg};color:${ink};
  display:flex;flex-direction:column;padding:74px 78px 66px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
.card::before{content:"";position:absolute;inset:20px;border:2px solid currentColor;opacity:.25;border-radius:16px}
.top{display:flex;justify-content:space-between;font:600 31px/1.2 "Be Vietnam Pro",sans-serif;letter-spacing:.03em;opacity:.8}
.mid{flex:1;display:flex;align-items:center;padding:28px 0;min-height:0}
#q{font-family:"Lora",Georgia,serif;font-weight:700;font-size:76px;line-height:1.28;letter-spacing:-.01em;text-wrap:pretty}
.bot{display:flex;justify-content:space-between;align-items:flex-end;font:400 30px/1.2 "Be Vietnam Pro",sans-serif;opacity:.72}
.bot .n{font-family:"Lora",Georgia,serif;font-weight:700;font-size:44px;line-height:1}
</style></head><body>
${paper(theme.paper, theme.rule, theme.ruleAlpha, theme.shimmer)}
<div class="sheet"><div class="card">
  <div class="top"><span>${esc(card.topic.name)}</span><span>có hay không?</span></div>
  <div class="mid" id="box"><p id="q">${esc(card.text)}</p></div>
  <div class="bot"><span>làm thân</span><span class="n">?</span></div>
</div></div>
<script>
document.fonts.ready.then(function(){
  var q = document.getElementById("q"), box = document.getElementById("box");
  var lo = 38, hi = 78;                        // biggest size that still fits the middle band
  for (var i = 0; i < 16; i++) {
    var mid = (lo + hi) / 2; q.style.fontSize = mid + "px";
    if (q.scrollHeight <= box.clientHeight - 56) lo = mid; else hi = mid;
  }
  q.style.fontSize = lo.toFixed(1) + "px";
  document.title = "ready";
});
</script></body></html>`;
}

function ctaPage() {
  const c = theme.cta;
  const n = Math.floor(DATA.total / 100) * 100;
  const body = opt.body || `hơn ${n} câu hỏi giúp bạn và người ấy, hội bạn thân hiểu nhau hơn mỗi ngày: chuyện tình yêu, tiền bạc, tâm sự đêm khuya và nhiều chủ đề khác.`;
  const head = String(opt.headline).split("\n").map(l => esc(l)).join("<br>");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">${BASE}<style>
.sheet{padding:64px;color:${c.ink}}
.frame{flex:1;border:2px solid ${c.ink}55;border-radius:30px;display:flex;flex-direction:column;padding:86px 88px 78px}
.brand{font:700 32px/1.2 "Be Vietnam Pro",sans-serif}
.gap-a{flex:1.05}
.gap-b{flex:1.35}
h1{font-family:"Lora",Georgia,serif;font-weight:700;font-size:64px;line-height:1.3;letter-spacing:-.01em}
.body{margin-top:34px;font:400 31px/1.62 "Be Vietnam Pro",sans-serif;opacity:.88;max-width:22em}
.pill{align-self:center;width:100%;max-width:790px;height:96px;border-radius:999px;background:${c.pill};color:${c.pillInk};
  display:flex;align-items:center;justify-content:center;font:700 39px/1 "Be Vietnam Pro",sans-serif;letter-spacing:.005em}
.foot{margin-top:30px;text-align:center;font:600 27px/1.4 "Be Vietnam Pro",sans-serif;opacity:.8}
</style></head><body>
${paper(c.bg, c.rule, c.ruleAlpha, c.shimmer)}
<div class="sheet"><div class="frame">
  <div class="brand">làm thân</div>
  <div class="gap-a"></div>
  <h1>${head}</h1>
  <p class="body">${esc(body)}</p>
  <div class="gap-b"></div>
  <div class="pill">${esc(opt.pill)}</div>
  <div class="foot">${esc(opt.foot)}</div>
</div></div>
<script>document.fonts.ready.then(function(){ document.title = "ready"; });</script></body></html>`;
}

/* ---------- chrome ---------- */
function chrome() {
  const guesses = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const g of guesses) if (fs.existsSync(g)) return g;
  console.error("No Chrome found. Install Google Chrome, or point CHROME=/path/to/chrome at one.");
  process.exit(1);
}

const BIN = chrome();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lamthan-"));
fs.mkdirSync(opt.out, { recursive: true });

function shoot(html, outFile) {
  const src = path.join(tmp, path.basename(outFile).replace(/\.png$/, ".html"));
  fs.writeFileSync(src, html);
  execFileSync(BIN, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
    "--window-size=1080,1350", "--virtual-time-budget=2500", "--allow-file-access-from-files",
    `--screenshot=${outFile}`, pathToFileURL(src),
  ], { stdio: "ignore" });
  if (!fs.existsSync(outFile)) { console.error("chrome produced nothing for " + outFile); process.exit(1); }
}

const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44);

const made = [];
cards.forEach((c, i) => {
  const f = path.join(opt.out, `${String(i + 1).padStart(2, "0")}-${c.topic.id}-${slug(c.text)}.png`);
  shoot(questionPage(c), f);
  made.push({ file: f, topic: c.topic.name, text: c.text });
  console.log(`  ${path.basename(f)}`);
});

if (!opt.noCta || opt.ctaOnly) {
  const f = path.join(opt.out, `${String(cards.length + 1).padStart(2, "0")}-lamthan-com.png`);
  shoot(ctaPage(), f);
  made.push({ file: f, kind: "cta" });
  console.log(`  ${path.basename(f)}`);
}

if (cards.length && !opt.q) {
  fs.appendFileSync(opt.used, cards.map(c => c.text).join("\n") + "\n");
}
fs.writeFileSync(path.join(opt.out, "cards.json"), JSON.stringify({ theme: opt.theme, made }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${made.length} ảnh 1080x1350 trong ${path.resolve(opt.out)}`);
