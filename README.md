# làm thân

"càng hỏi, càng thân." A Vietnamese question card game for friends, couples and teams.
Pick one or more topics, flip a card, everyone answers yes or no at the same time, then each person says why.

Live: https://lamthan.com

## Layout

| Path | What it is |
|---|---|
| `src/app.html` | The app itself: styles, topics, questions, sketches, game logic. Edit this, not `index.html`. |
| `index.html` | Built page, deployed by Vercel. Regenerate with `./build.sh`. |
| `build.sh` | Wraps `src/app.html` with the page head: icons, link preview, manifest. |
| `src/sketch.js` | The topic sketches (ink drawings drawn in code). Also inlined into `src/app.html`. |
| `src/og.html` | Source of `og.png`, the image shown when the link is shared. |
| `tools/smoke.js` | Plays a full game in a simulated browser (jsdom) and reports errors. |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | App icon. |
| `site.webmanifest` | Home-screen app settings. |
| `vercel.json` | Redirects the old addresses to lamthan.vercel.app. |

## Everyday commands

```bash
./build.sh                       # rebuild index.html after editing src/app.html
npx vercel deploy --prod --yes   # deploy to https://lamthan.com
cd /tmp && npm i jsdom && node ~/nguoi-la-thanh-quen/tools/smoke.js   # play-test
```

Regenerate the link-preview image after changing wording or sketches:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1200,630 --virtual-time-budget=5000 \
  --screenshot=og.png "file://$PWD/src/og.html"
```

## Questions

The questions live in `src/app.html` (the `TOPICS` array), but the master list is the
**Question Inbox**, a private Claude artifact with its own database:

https://claude.ai/artifact/38maBnVQTNdQvNzNk8okvb

There you approve new questions Claude writes, edit or remove the ones in the app, and add your own.
Then ask Claude to "ship": it copies the approved list back into `src/app.html`, rebuilds and deploys.

Topics: tình yêu, chuyện ấy (18+), tiền bạc, gia đình, bạn bè, đời sống & mạng,
công việc & học hành, tâm sự đêm khuya.
