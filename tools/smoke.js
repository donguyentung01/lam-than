const {JSDOM} = require("jsdom");
const html = require("fs").readFileSync(process.env.HOME + "/nguoi-la-thanh-quen/index.html","utf8");
const errors = [];
const dom = new JSDOM(html, {runScripts:"dangerously", pretendToBeVisual:true, url:"https://x.test/",
  beforeParse(w){ w.matchMedia = () => ({matches:true}); w.scrollTo = () => {}; w.HTMLCanvasElement.prototype.getContext = () => null;
    w.addEventListener("error", e => errors.push(e.message)); }});
const w = dom.window, d = w.document, $ = id => d.getElementById(id);
const click = el => el.dispatchEvent(new w.MouseEvent("click", {bubbles:true}));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(50);
  console.log("home modes:", $("mode-hoi-meta").textContent, "|", $("mode-tod-meta").textContent);
  click($("mode-hoi")); await wait(5);                 // the deck grid lives behind the câu hỏi mode now
  console.log("topics:", [...d.querySelectorAll(".deck")].map(b => b.querySelector("h3").textContent + " " + b.querySelector(".meta").textContent).join(" | "));
  for(const ids of [["yeu"],["ay"],["tien","nha","triet"]]){
    ids.forEach(id => click(d.querySelector(`.deck[data-id="${id}"]`)));
    console.log("---", $("pick-go").textContent);
    click($("pick-go"));
    if(!$("agegate").hidden){ console.log(" age gate shown"); click($("age-ok")); }
    console.log(" first card face up:", $("card").classList.contains("flipped"), "| screen play:", !$("s-play").hidden, "| hud:", $("hud-title").textContent, $("hud-count").textContent, "| flipped:", $("card").classList.contains("flipped"));
    click($("card"));
    console.log(" card:", $("f-topic").textContent, "|", $("q").textContent, "| next btn:", $("next").textContent);
    
    const total = +$("hud-count").textContent.split("/")[1]; let reshuffled = false, faceDown = 0;
    for(let i=0;i<total+3;i++){ click($("next")); await wait(2); if(!$("card").classList.contains("flipped")) faceDown++; if($("count").textContent.startsWith("Hết một vòng")) reshuffled = true; }
    click($("skip")); await wait(2);
    console.log(" after", total+3, "cards: reshuffled:", reshuffled, "| face-down cards after first:", faceDown, "| hud:", $("hud-count").textContent);
    click($("play-back")); await wait(2);
    ids.forEach(id => click(d.querySelector(`.deck[data-id="${id}"]`)));
  }

  // --- thật hay thách ---
  click($("decks-back")); await wait(5); click($("mode-tod")); await wait(5);
  console.log("--- thật hay thách:", [...d.querySelectorAll(".deck")].map(b => b.querySelector("h3").textContent + " " + b.querySelector(".meta").textContent).join(" | "));
  click(d.querySelector('.deck[data-id="t-ay"]'));
  console.log("---", $("pick-go").textContent);
  click($("pick-go"));
  if(!$("agegate").hidden){ console.log(" age gate shown"); click($("age-ok")); }
  console.log(" piles:", !$("piles").hidden, "| card hidden:", $("tod-table").hidden, "|", $("n-truth").textContent, "/", $("n-dare").textContent);
  for(const kind of ["truth","dare","truth"]){
    click($("pile-"+kind)); await wait(2);
    console.log(" ", $("tod-tag").textContent + ":", $("tod-q").textContent.slice(0,44), "| hud:", $("tod-hud-count").textContent);
    click($("tod-next")); await wait(2);
  }
  let drained = 0;
  for(let i=0;i<24;i++){ click($("pile-dare")); await wait(1); click($("tod-next")); await wait(1); drained++; }
  console.log(" after", drained, "thách:", $("n-dare").textContent, "left | hud:", $("tod-hud-count").textContent, "| piles shown:", !$("piles").hidden);
  click($("tod-back")); await wait(2);
  console.log(" back lands on the deck grid:", !$("s-decks").hidden);
  console.log("leftover old UI:", ["s-setup","interlude","penalty","level-up"].filter(id => $(id)).join(",") || "none");
  console.log("errors:", errors.length ? errors : "none");
  dom.window.close();          // the page polls on a timer; close it so the script exits
  process.exit(0);
})();
