---
name: lam-than-cards
description: Make Threads/Instagram post images for làm thân (lamthan.com), the Vietnamese question-card app. Renders 1080x1350 question cards from the app's real question bank plus a matching lamthan.com promo card. Use when asked to make cards, seeding posts, carousel images, or promo images for làm thân.
---

# Làm thân card images

Turns the app's own questions into 1080x1350 (4:5) images for a Threads carousel: a few
question cards, then one promo card pointing at lamthan.com.

The cards are drawn from the same palette, fonts and layout as the site, so a post looks
like it came from the app. Question cards show a `?` in the bottom right, never a number.

## Before anything

Needs `node` (18+) and Google Chrome installed. No npm install, no network: fonts ship in
`fonts/`. If Chrome lives somewhere unusual, set `CHROME=/path/to/chrome`.

Run everything from this skill's own folder.

## Making a post

Start by seeing what is there:

```bash
node render.mjs --list
```

Then render a set. This is the normal call: 3 question cards plus the promo card, all from
one topic, into a dated folder.

```bash
node render.mjs --topic yeu --pick 3 --out ~/Desktop/threads-2026-09-22
```

| flag | what it does |
| --- | --- |
| `--topic <id>` | one topic id from `--list`, or `all` to mix (default `all`) |
| `--pick <n>` | how many question cards (default 3) |
| `--q "..."` | render one exact question instead of picking; pair with `--topic` for the right colour |
| `--theme <id>` | `dongho` (default, cream paper) or `trungthu`, `sonmai`, `tet`, `saigon` |
| `--out <dir>` | where the PNGs go (default `./cards`) |
| `--no-cta` | skip the promo card |
| `--cta-only` | just the promo card |
| `--seed <n>` | same seed picks the same questions again |
| `--adult` | let the 18+ topic (`ay`, Chuyện Ấy) into an `all` mix |
| `--headline`, `--body`, `--pill`, `--foot` | override the promo card's copy |

Every run appends the questions it used to `used.txt`, and later runs avoid them, so a week
of posting will not repeat itself. Delete that file to start over.

## Choosing what to post

- One topic per post reads better than a mix. The card colour comes from the topic, so a
  single-topic carousel is one colour and looks deliberate.
- 3 to 5 question cards is the right length. The promo card always goes last.
- Chuyện Ấy (`ay`) is 18+. Only reach for it when the person asks, and say so when you do.
- `--theme trungthu` matches what lamthan.com currently looks like. `dongho` is the
  evergreen look and the safest default.

## Writing the caption

The post still needs a caption. House voice, worth matching:

- all lowercase, including the first word
- no em dashes or en dashes, use a comma or a colon
- short, spoken Vietnamese, no marketing adjectives
- ask, do not announce: pose one of the questions to the reader and let them answer in
  the replies

A caption that works:

> mấy câu này hỏi xong là biết ngay hợp hay không hợp.
> bạn chọn câu nào để hỏi trước?
> cả bộ ở lamthan.com

Never claim a question count the data does not support. `--list` prints the real total.

## Keeping the questions current

`questions.json` is a copy of the app's bank, taken on the date in its `updated` field.
When the app gains questions, refresh it from a checkout of the app repo:

```bash
node - <<'EOF'
const fs = require("fs");
const src = fs.readFileSync(process.env.HOME + "/nguoi-la-thanh-quen/src/app.html", "utf8");
const body = src.slice(src.indexOf("const TOPICS ="));
const arr = body.slice(body.indexOf("["), body.indexOf("\n];") + 2);
const TOPICS = eval("(" + arr + ")");
const out = TOPICS.map((t, i) => ({ id: t.id, name: t.name, sub: t.sub, adult: !!t.adult, ci: i % 4, cards: t.cards }));
fs.writeFileSync("questions.json", JSON.stringify({ site: "lamthan.com", updated: new Date().toISOString().slice(0, 10),
  total: out.reduce((n, t) => n + t.cards.length, 0), topics: out }, null, 1));
console.log("wrote", out.reduce((n, t) => n + t.cards.length, 0), "questions");
EOF
```

`themes.json` holds the five palettes, also copied from the app. Only touch it if the site's
colours change.

## Files

- `render.mjs` the renderer, no dependencies
- `questions.json` every question in the app, by topic
- `themes.json` the five site palettes
- `fonts/`, `fonts.css` Lora and Be Vietnam Pro, subset for Vietnamese, so rendering works offline
- `used.txt` written as you go, questions already posted
