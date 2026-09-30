#!/bin/sh
# 把 src/ 內的程式合併成 app.js（部署時只需要 index.html、style.css、exercises.js、app.js）
cd "$(dirname "$0")"
{
  echo "/*! LogicLab 邏輯閘練習 | 單檔前端應用（由 src/ 合併產生，請修改 src/ 後重新執行 build.sh） */"
  echo "(function () {"
  echo "'use strict';"
  for f in src/*.js; do echo; cat "$f"; done
  echo "})();"
} > app.js
