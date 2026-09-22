/* Walk the built page in jsdom: the free visitor meets the wall, the paying one plays on.
   /api is stubbed, so this exercises the page, not the server. */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));

function open({ code = "" } = {}) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://x.test/",
    beforeParse(w) {
      w.matchMedia = () => ({ matches: true });
      w.scrollTo = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.addEventListener("error", e => errors.push(e.message));
      if (code) w.localStorage.setItem("nltq-key", code);
      w.fetch = async url => {
        if (String(url).startsWith("/api/cards")) {
          if (!code) return { json: async () => ({ ok: false, reason: "invalid" }) };
          const until = Object.fromEntries([...Object.keys(BANK.topics), ...Object.keys(BANK.tod)]
            .map(id => [id, Date.now() + 24 * 3600e3]));
          return { json: async () => ({ ok: true, code, until, topics: BANK.topics, tod: BANK.tod }) };
        }
        return { json: async () => ({ enabled: false }) };
      };
    },
  });
  const w = dom.window, d = w.document;
  return { dom, w, d, errors, $: id => d.getElementById(id), click: el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })) };
}

let BANK;
(async () => {
  ({ BANK } = await import("file://" + path.join(ROOT, "api/_bank.js")));

  // ---------- a visitor who has paid nothing ----------
  {
    const { w, d, $, click, errors } = open();
    await wait(60);
    console.log("home:", $("mode-hoi-meta").textContent, "|", $("mode-tod-meta").textContent);
    click($("mode-hoi")); await wait(5);
    console.log("decks:", [...d.querySelectorAll(".deck")].map(b => b.querySelector("h3").textContent + " " + b.querySelector(".meta").textContent).join(" | "));
    click(d.querySelector('.deck[data-id="yeu"]'));
    click($("pick-go")); await wait(10);
    let n = 0;
    while ($("paywall").hidden && n < 30) { click($("next")); await wait(3); n++; }
    console.log(" trial ran", n, "cards then walled:", !$("paywall").hidden, "| hud:", $("hud-count").textContent, "| offers:", $("pw-decks").textContent.trim());
    click($("pw-close")); await wait(5);
    click(d.querySelector('.deck[data-id="yeu"]'));            // unpick
    click(d.querySelector('.deck[data-id="viec"]'));           // a deck with no trial at all
    click($("pick-go")); await wait(10);
    console.log(" locked deck walls without dealing:", !$("paywall").hidden && $("s-play").hidden);
    console.log(" free visitor errors:", errors.length ? errors : "none");
    w.close();
  }

  // ---------- a visitor holding a pass for everything ----------
  {
    const { w, d, $, click, errors } = open({ code: "LT-TEST-TEST" });
    await wait(120);
    click($("mode-hoi")); await wait(10);
    for (const ids of [["yeu"], ["ay"], ["tien", "nha", "triet"]]) {
      ids.forEach(id => click(d.querySelector(`.deck[data-id="${id}"]`)));
      console.log("---", $("pick-go").textContent);
      click($("pick-go")); await wait(10);
      if (!$("agegate").hidden) { console.log(" age gate shown"); click($("age-ok")); await wait(10); }
      console.log(" first card face up:", $("card").classList.contains("flipped"), "| hud:", $("hud-title").textContent, $("hud-count").textContent);
      const total = +$("hud-count").textContent.split("/")[1];
      let reshuffled = false, faceDown = 0, walled = false;
      for (let i = 0; i < total + 3; i++) {
        click($("next")); await wait(2);
        if (!$("card").classList.contains("flipped")) faceDown++;
        if (!$("paywall").hidden) { walled = true; break; }
        if ($("count").textContent.startsWith("Hết một vòng")) reshuffled = true;
      }
      click($("skip")); await wait(2);
      console.log(` after ${total + 3} cards: reshuffled: ${reshuffled} | walled: ${walled} | face-down after first: ${faceDown} | hud: ${$("hud-count").textContent}`);
      click($("play-back")); await wait(5);
      ids.forEach(id => click(d.querySelector(`.deck[data-id="${id}"]`)));
    }

    click($("decks-back")); await wait(5); click($("mode-tod")); await wait(10);
    console.log("--- thật hay thách:", [...d.querySelectorAll(".deck")].map(b => b.querySelector("h3").textContent + " " + b.querySelector(".meta").textContent).join(" | "));
    click(d.querySelector('.deck[data-id="t-ay"]'));
    console.log("---", $("pick-go").textContent);
    click($("pick-go")); await wait(10);
    if (!$("agegate").hidden) { console.log(" age gate shown"); click($("age-ok")); await wait(10); }
    console.log(" piles:", !$("piles").hidden, "|", $("n-truth").textContent, "/", $("n-dare").textContent);
    for (const kind of ["truth", "dare", "truth"]) {
      click($("pile-" + kind)); await wait(2);
      console.log(" ", $("tod-tag").textContent + ":", $("tod-q").textContent.slice(0, 44), "| hud:", $("tod-hud-count").textContent);
      click($("tod-next")); await wait(2);
    }
    for (let i = 0; i < 24; i++) { click($("pile-dare")); await wait(1); click($("tod-next")); await wait(1); }
    console.log(" after 24 thách:", $("n-dare").textContent, "left | hud:", $("tod-hud-count").textContent, "| piles shown:", !$("piles").hidden);
    click($("tod-back")); await wait(2);
    console.log(" back lands on the deck grid:", !$("s-decks").hidden);
    console.log("leftover old UI:", ["s-setup", "interlude", "penalty", "level-up"].filter(id => $(id)).join(",") || "none");
    console.log("paid visitor errors:", errors.length ? errors : "none");
    w.close();
  }
  process.exit(0);
})();
