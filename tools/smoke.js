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
  console.log("leftover old UI:", ["s-setup","interlude","penalty","level-up"].filter(id => $(id)).join(",") || "none");
  console.log("errors:", errors.length ? errors : "none");
})();
