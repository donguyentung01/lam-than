#!/bin/bash
# Build src/app.html into index.html with the real <head> (icons, link preview, manifest).
set -e
cd "$(dirname "$0")"
S=src/app.html
URL=https://lamthan.com
DESC="Bộ câu hỏi để hiểu nhau hơn, cho những buổi cà phê, họp lớp, team building và những cuộc trò chuyện sâu."
{
  printf '<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#efe6d2">\n'
  printf '<meta name="description" content="%s">\n' "$DESC"
  printf '<link rel="icon" href="/icon.svg" type="image/svg+xml">\n<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n<meta name="apple-mobile-web-app-title" content="làm thân">\n'
  printf '<meta property="og:type" content="website">\n<meta property="og:site_name" content="làm thân">\n<meta property="og:title" content="làm thân · càng hỏi, càng thân">\n<meta property="og:description" content="%s">\n<meta property="og:url" content="%s/">\n<meta property="og:image" content="%s/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:locale" content="vi_VN">\n' "$DESC" "$URL" "$URL"
  printf '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="làm thân · càng hỏi, càng thân">\n<meta name="twitter:description" content="%s">\n<meta name="twitter:image" content="%s/og.png">\n' "$DESC" "$URL"
  printf '<style>*,*::before,*::after{box-sizing:border-box}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  sed -n '1,/^<\/style>/p' "$S"; sed -n '/^<\/style>/{n;p;}' "$S" | head -1; printf '</head>\n<body>\n'
  sed -n '/^<\/style>/,$p' "$S" | tail -n +3; printf '</body>\n</html>\n'
} > index.html
echo "built index.html from $S"
