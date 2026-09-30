/* ============================================================
 * 10 繳交、存檔、匯出圖片
 * ============================================================ */
function readStudent() { return { id: $('#stuId').value.trim().slice(0, 20), name: $('#stuName').value.trim().slice(0, 20) }; }
function validateStudent() {
  const s = readStudent(), err = $('#stuErr');
  if (!s.id || !s.name) {
    err.textContent = '請先填寫學號與姓名';
    err.hidden = false;
    setTab('submit');
    openPanelOnMobile();
    (s.id ? $('#stuName') : $('#stuId')).focus();
    return null;
  }
  err.hidden = true;
  store.set('student', s);
  return s;
}
function subSig(sub) { const c = Object.assign({}, sub); delete c.sig; return hash2(stableStringify(c)); }
function buildSubmission(student) {
  const a = S.asg;
  const res = a ? checkCircuit(a, S.circ) : null;
  const sub = {
    app: 'logiclab', kind: 'submission', v: 1, ver: APP.version,
    student: { id: String(student.id || ''), name: String(student.name || '') },
    assignment: a ? compactAssignment(a, false) : null,
    circuit: toCompact(S.circ),
    meta: { createdAt: S.meta.createdAt, submittedAt: new Date().toISOString(), edits: S.meta.edits, activeSec: Math.round(S.meta.activeSec) },
    self: res && a.selfCheck ? { pass: res.pass, correct: res.correct, total: res.total, gates: res.gateCount } : null
  };
  sub.sig = subSig(sub);
  return sub;
}
/** 檔名只用英數字（學號_題目代號），避免部分系統或教學平台無法處理中文檔名；姓名存在檔案內容裡 */
function subBaseName(st) {
  const sid = String(st.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'student';
  return `${sid}_${S.asg ? S.asg.id : 'free'}`;
}
function downloadSubmission() {
  const st = validateStudent();
  if (!st) return;
  const sub = buildSubmission(st);
  const name = subBaseName(st) + '.json';
  download(name, JSON.stringify(sub, null, 1), 'application/json');
  toast('已下載作業檔：' + name, 'ok');
}
async function copySubmissionCode() {
  const st = validateStudent();
  if (!st) return;
  const code = await packCode(SUB_PREFIX, buildSubmission(st));
  $('#codeBox').hidden = false;
  const ta = $('#codeText');
  ta.value = code;
  const ok = await copyText(code);
  if (ok) toast(`已複製繳交代碼（${code.length} 個字元），請貼到表單`, 'ok');
  else { toast('無法自動複製，請全選下方代碼後手動複製', 'warn', 4000); ta.focus(); ta.select(); }
}

/* ---------- 電路檔 ---------- */
function saveCircuitFile() {
  const data = {
    app: 'logiclab', kind: 'circuit', v: 1, ver: APP.version, savedAt: new Date().toISOString(),
    assignment: S.asg ? compactAssignment(S.asg, !S.asg.builtin) : null,
    circuit: toCompact(S.circ)
  };
  const name = `logiclab_${S.asg ? S.asg.id : 'free'}_${stampForFile()}.json`;
  download(name, JSON.stringify(data), 'application/json');
  toast('已儲存電路檔：' + name, 'ok');
}
async function openCircuitFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('檔案格式不正確（需要 LogicLab 的 .json 檔）', 'err'); return; }
  if (!data || data.app !== 'logiclab' || !data.circuit) { toast('這不是 LogicLab 的電路檔或作業檔', 'err'); return; }
  if (data.assignment) {
    try {
      const emb = expandAssignment(data.assignment);
      const target = BUILTIN.has(emb.id) ? BUILTIN.get(emb.id) : emb;
      if (!S.asg || S.asg.hash !== target.hash) await openAssignmentObject(target);
    } catch (e) { /* 題目資料有問題時，只載入電路 */ }
  }
  replaceCircuit(fromCompact(data.circuit));
  toast('已開啟：' + file.name, 'ok');
}

/* ---------- 匯出圖片 ---------- */
function exportSVGString(circ, opts = {}) {
  const P = PAL_LIGHT;
  const comp = compile(circ), val = comp.run(null);
  const R = routeWires(circ, comp.idx, opts.wire || 'ortho');
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const grow = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
  for (const c of circ.comps) { const b = visualBox(c); grow(b.x1, b.y1, b.x2, b.y2); }
  for (const r of R.paths.values()) if (r.pts) for (const [x, y] of r.pts) grow(x, y, x, y);
  if (!isFinite(x1)) { x1 = 0; y1 = 0; x2 = 240; y2 = 120; }
  const m = 24, headH = opts.title ? 60 : 0;
  const cw = x2 - x1 + 2 * m, ch = y2 - y1 + 2 * m;
  let ttSvg = '', ttW = 0, ttH = 0;
  if (opts.tt) {
    const tt = truthTable(circ, opts.asg, comp);
    if (tt.ins.length && tt.ins.length <= 5 && tt.outs.length && tt.outs.length <= 6) {
      const cols = [...tt.ins.map(c => c.label), ...tt.outs.map(c => c.label)];
      const cwid = Math.max(30, ...cols.map(s => textW(s, 14) + 14)), rh = 21;
      ttW = cols.length * cwid; ttH = (tt.rows.length + 1) * rh;
      const ox = cw + 8, oy = headH + m;
      const o = [`<g transform="translate(${ox},${oy})" font-family="Consolas, Menlo, monospace">`];
      o.push(`<rect x="0" y="0" width="${ttW}" height="${rh}" fill="#F3F7FA"/>`);
      cols.forEach((s, i) => o.push(tx(i * cwid + cwid / 2, rh / 2, s, { fill: i < tt.ins.length ? P.text : '#2683C6', size: 13, weight: 800 })));
      tt.rows.forEach((row, ri) => {
        const y = (ri + 1) * rh;
        [...row.ins, ...row.outs].forEach((v, i) => {
          const isOut = i >= tt.ins.length;
          o.push(tx(i * cwid + cwid / 2, y + rh / 2, v === 1 ? '1' : v === 0 ? '0' : '?', { fill: isOut && v === 1 ? P.hi : P.text, size: 13, weight: isOut ? 800 : 500 }));
        });
        o.push(`<line x1="0" y1="${y}" x2="${ttW}" y2="${y}" stroke="#C9D6E0" stroke-width="1"/>`);
      });
      o.push(`<line x1="${tt.ins.length * cwid}" y1="0" x2="${tt.ins.length * cwid}" y2="${ttH}" stroke="#9FB3C3" stroke-width="2"/>`);
      o.push(`<rect x="0" y="0" width="${ttW}" height="${ttH}" fill="none" stroke="#9FB3C3" stroke-width="1.2" rx="3"/></g>`);
      ttSvg = o.join('');
    }
  }
  const W = Math.ceil(Math.max(cw + (ttW ? ttW + 24 : 0), opts.title ? 420 : 0));
  const H = Math.ceil(headH + Math.max(ch, ttH ? ttH + 2 * m : 0));
  const vcol = v => v === 1 ? P.hi : v === 0 ? P.lo : P.x;
  const wires = [];
  for (const w of circ.wires) {
    const r = R.paths.get(w.id);
    if (!r) continue;
    const v = val.get(w.from);
    wires.push(`<path d="${r.d || ptsToD(r.pts)}" style="stroke:${vcol(v)}" stroke-width="${v === 1 ? 3 : 2.4}" fill="none" stroke-linejoin="round" stroke-linecap="round"${v === 1 || v === 0 ? '' : ' stroke-dasharray="6 4"'}/>`);
  }
  for (const [x, y, net] of R.dots) wires.push(`<circle cx="${x}" cy="${y}" r="3.8" style="fill:${vcol(val.get(net))}"/>`);
  const ctx = { P, val, idx: comp.idx, live: false, iec: !!opts.iec, captions: !!opts.captions, badges: false, hot: null };
  const comps = circ.comps.map(c => compSVG(c, ctx)).join('');
  const head = opts.title
    ? tx(16, 22, opts.title, { fill: '#335B74', size: 18, weight: 800, anchor: 'start' }) + tx(16, 45, opts.subtitle || '', { fill: '#6B7F8E', size: 13, weight: 500, anchor: 'start' }) +
      `<line x1="0" y1="${headH - 1}" x2="${W}" y2="${headH - 1}" stroke="#E1E8EE" stroke-width="1"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Microsoft JhengHei, PingFang TC, Noto Sans TC, Noto Sans CJK TC, Heiti TC, sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/>${head}<g transform="translate(${r1(m - x1)},${r1(headH + m - y1)})">${wires.join('')}${comps}</g>${ttSvg}</svg>`;
  return { svg, W, H };
}
async function svgToPng(svg, W, H, scale = 2) {
  scale = Math.min(scale, 8000 / Math.max(W, H));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('圖片產生失敗')); img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('圖片產生失敗'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
function currentExportSVG(withHeader, student) {
  const a = S.asg;
  const sub = [student ? `${student.id} ${student.name}` : null, fmtTime(new Date().toISOString()), 'LogicLab'].filter(Boolean).join('　·　');
  return exportSVGString(S.circ, {
    title: withHeader ? (a ? a.title : '邏輯電路') : null, subtitle: sub, asg: a, tt: withHeader,
    iec: S.settings.symbol === 'iec', wire: S.settings.wire, captions: false
  });
}
async function exportPNG(forSubmit) {
  let st = null;
  if (forSubmit) { st = validateStudent(); if (!st) return; }
  if (!S.circ.comps.length) { toast('畫布是空的', 'warn'); return; }
  try {
    const { svg, W, H } = currentExportSVG(true, st);
    const blob = await svgToPng(svg, W, H, 2);
    const name = st ? subBaseName(st) + '.png' : `logiclab_${S.asg ? S.asg.id : 'free'}_${stampForFile()}.png`;
    download(name, blob, 'image/png');
    toast('已下載電路圖：' + name, 'ok');
  } catch (e) { toast('圖片產生失敗：' + e.message, 'err'); }
}
async function copyImage() {
  if (!S.circ.comps.length) { toast('畫布是空的', 'warn'); return; }
  const { svg, W, H } = currentExportSVG(false, null);
  const pngPromise = svgToPng(svg, W, H, 3);
  try {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('unsupported');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise })]);
    toast('電路圖已複製，可以直接貼到簡報或文件', 'ok');
  } catch (e) {
    try { download(`logiclab_${stampForFile()}.png`, await pngPromise, 'image/png'); toast('瀏覽器不允許複製圖片，已改為下載 PNG', 'warn'); }
    catch (e2) { toast('圖片產生失敗', 'err'); }
  }
}
