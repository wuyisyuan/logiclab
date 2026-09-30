/* ============================================================
 * 08 編輯器：狀態、繪製、滑鼠／觸控操作、鍵盤、復原
 * ============================================================ */
function freshMeta() { return { createdAt: null, edits: 0, activeSec: 0, lastEdit: 0 }; }
const S = {
  circ: newCircuit(), sel: new Set(), selWire: null,
  view: { x: 60, y: 60, k: 1 },
  asg: null, key: null, booted: false,
  undo: [], redo: [],
  geoVer: 0, editVer: 0, checkVer: -1, route: null, comp: null, val: null, lastCheck: null,
  meta: freshMeta(),
  settings: Object.assign({ wire: 'ortho', symbol: 'ansi', captions: true, badges: true, theme: 'auto', showExpected: true }, store.get('settings', {})),
  tab: 'task',
  mode: null, drag: null, wiring: null, pan: null, box: null, pinch: null, pending: null,
  pointers: new Map(), clip: null, rect: null, raf: 0,
  timing: { steps: 8, seq: {}, timer: 0, cursor: -1 }
};
let board, viewport, gridBg, layerWires, layerComps, layerOverlay, selTools, boardEmpty, boardBanner, statusBar, zoomLabel, boardWrap;
function initDom() {
  board = $('#board'); viewport = $('#viewport'); gridBg = $('#gridBg');
  layerWires = $('#layerWires'); layerComps = $('#layerComps'); layerOverlay = $('#layerOverlay');
  selTools = $('#selTools'); boardEmpty = $('#boardEmpty'); boardBanner = $('#boardBanner');
  statusBar = $('#statusBar'); zoomLabel = $('#zoomLabel'); boardWrap = $('#boardWrap');
}
const byId = id => S.circ.comps.find(c => c.id === id);

function resolvedTheme() {
  const t = S.settings.theme;
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function pal() { return resolvedTheme() === 'dark' ? PAL_DARK : PAL_LIGHT; }

/* ---------- 繪製 ---------- */
function requestRender() { if (!S.raf) S.raf = requestAnimationFrame(render); }
function render() {
  S.raf = 0;
  const P = pal();
  const comp = compile(S.circ);
  const val = comp.run(null);
  S.comp = comp; S.val = val;
  const rkey = S.geoVer + '|' + S.settings.wire;
  if (!S.route || S.route.key !== rkey) S.route = { key: rkey, r: routeWires(S.circ, comp.idx, S.settings.wire) };
  const R = S.route.r;
  const vcol = v => v === 1 ? P.hi : v === 0 ? P.lo : P.x;

  const ws = [], hits = [];
  for (const w of S.circ.wires) {
    const r = R.paths.get(w.id);
    if (!r) continue;
    const d = r.d || ptsToD(r.pts), v = val.get(w.from);
    if (S.selWire === w.id) ws.push(`<path d="${d}" style="stroke:${P.sel}" stroke-width="9" stroke-opacity="0.45" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
    ws.push(`<path d="${d}" style="stroke:${vcol(v)}" stroke-width="${v === 1 ? 3 : 2.4}" fill="none" stroke-linejoin="round" stroke-linecap="round"${v === 1 || v === 0 ? '' : ' stroke-dasharray="6 4"'}/>`);
    hits.push(`<path d="${d}" class="wirehit" data-wire="${w.id}" style="stroke:transparent" stroke-width="12" fill="none"/>`);
  }
  for (const [x, y, net] of R.dots) ws.push(`<circle cx="${x}" cy="${y}" r="3.8" style="fill:${vcol(val.get(net))}"/>`);
  layerWires.innerHTML = ws.join('') + hits.join('');

  const bad = new Set(comp.cyc);
  if (S.asg) {
    for (const c of S.circ.comps) {
      if (!isGate(c.type)) continue;
      if ((S.asg.allowed && !S.asg.allowed.includes(c.type)) || (S.asg.maxFanIn && nIns(c) > S.asg.maxFanIn)) bad.add(c.id);
    }
  }
  const hot = new Set();
  const wr = S.wiring || S.pending;
  if (wr) { hot.add(pinKey(wr.from)); if (wr.hot) hot.add(pinKey(wr.hot)); }
  const ctx = { P, val, idx: comp.idx, live: true, sel: S.sel, bad, hot, iec: S.settings.symbol === 'iec', captions: S.settings.captions, badges: S.settings.badges };
  layerComps.innerHTML = S.circ.comps.map(c => compSVG(c, ctx)).join('');
  renderOverlay(P);

  boardEmpty.hidden = S.circ.comps.length > 0;
  if (S.pending) showBanner('info', '已選擇一個接腳：再點另一個元件的接腳就能連線（Esc 取消）');
  else if (comp.cyc.size) showBanner('err', '偵測到迴路：組合邏輯電路的輸出不能再接回前面的輸入（迴路中的訊號顯示為 ?）');
  else boardBanner.hidden = true;
  renderStatus(comp);
}
function renderOverlay(P) {
  const o = [];
  const wr = S.wiring || S.pending;
  if (wr && wr.cur && (!S.wiring || S.wiring.moved)) {
    const [px, py] = pinWorld(wr.from);
    let [qx, qy] = [wr.cur.x, wr.cur.y];
    if (wr.hot) [qx, qy] = pinWorld(wr.hot);
    const [sx, sy, tx2, ty2] = wr.from.isOut ? [px, py, qx, qy] : [qx, qy, px, py];
    const dx = Math.max(30, Math.abs(tx2 - sx) * 0.5);
    o.push(`<path d="M${sx},${sy} C${sx + dx},${sy} ${tx2 - dx},${ty2} ${tx2},${ty2}" style="stroke:${P.sel}" stroke-width="2.6" fill="none" stroke-linecap="round"${wr.hot ? '' : ' stroke-dasharray="7 5"'}/>`);
  }
  if (S.box) {
    const b = normBox(S.box);
    o.push(`<rect x="${b.x1}" y="${b.y1}" width="${b.x2 - b.x1}" height="${b.y2 - b.y1}" style="fill:${P.sel};stroke:${P.sel}" fill-opacity="0.08" stroke-width="${1.2 / S.view.k}" stroke-dasharray="5 4"/>`);
  }
  layerOverlay.innerHTML = o.join('');
}
function renderStatus(comp) {
  const gates = countGates(S.circ);
  let floating = 0;
  for (const c of S.circ.comps) for (let i = 0; i < nIns(c); i++) if (!comp.idx.driver.has(c.id + ':' + i)) floating++;
  const parts = [];
  if (S.asg && S.asg.maxGates) parts.push(`<span${gates > S.asg.maxGates ? ' class="err"' : ''}>閘 <b>${gates}</b> / ${S.asg.maxGates}</span>`);
  else parts.push(`<span>閘 <b>${gates}</b></span>`);
  parts.push(`<span>導線 <b>${S.circ.wires.length}</b></span>`);
  if (floating) parts.push(`<span class="warn">⚠ ${floating} 個輸入端未接線</span>`);
  if (comp.cyc.size) parts.push('<span class="err">⚠ 有迴路</span>');
  statusBar.innerHTML = parts.join('');
}
function showBanner(kind, msg) {
  boardBanner.className = 'board-banner ' + kind;
  if (boardBanner.textContent !== msg) boardBanner.textContent = msg;
  boardBanner.hidden = false;
}
function normBox(b) { return { x1: Math.min(b.x0, b.x1), y1: Math.min(b.y0, b.y1), x2: Math.max(b.x0, b.x1), y2: Math.max(b.y0, b.y1) }; }

/* ---------- 視角 ---------- */
function boardRect() { return S.rect || (S.rect = boardWrap.getBoundingClientRect()); }
function toWorld(cx, cy) { const r = boardRect(); return { x: (cx - r.left - S.view.x) / S.view.k, y: (cy - r.top - S.view.y) / S.view.k }; }
function applyView() {
  const { x, y, k } = S.view, r = boardRect();
  viewport.setAttribute('transform', `translate(${r1(x)},${r1(y)}) scale(${Math.round(k * 1000) / 1000})`);
  gridBg.setAttribute('x', r1(-x / k - 40));
  gridBg.setAttribute('y', r1(-y / k - 40));
  gridBg.setAttribute('width', r1(r.width / k + 80));
  gridBg.setAttribute('height', r1(r.height / k + 80));
  zoomLabel.textContent = Math.round(k * 100) + '%';
  if (S.box) requestRender();
}
function zoomAt(mx, my, k) {
  k = clamp(k, 0.25, 3);
  const wx = (mx - S.view.x) / S.view.k, wy = (my - S.view.y) / S.view.k;
  S.view.k = k; S.view.x = mx - wx * k; S.view.y = my - wy * k;
  applyView();
}
function zoomBy(f) { const r = boardRect(); zoomAt(r.width / 2, r.height / 2, S.view.k * f); }
function fitView() {
  S.rect = null;
  const r = boardRect();
  if (!r.width || !r.height) return;
  if (!S.circ.comps.length) { S.view = { x: 60, y: 60, k: 1 }; applyView(); return; }
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const c of S.circ.comps) {
    const b = visualBox(c);
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
  }
  const padX = 40, padTop = 64, padBot = 56;
  const k = clamp(Math.min((r.width - 2 * padX) / Math.max(1, x2 - x1), (r.height - padTop - padBot) / Math.max(1, y2 - y1)), 0.35, 1.3);
  S.view.k = k;
  S.view.x = (r.width - (x2 - x1) * k) / 2 - x1 * k;
  S.view.y = padTop + (r.height - padTop - padBot - (y2 - y1) * k) / 2 - y1 * k;
  applyView();
}

/* ---------- 變更與復原 ---------- */
function snapshot() { return JSON.stringify(S.circ); }
function afterEdit() {
  S.geoVer++; S.editVer++;
  noteEdit(); scheduleSave(); requestRender(); schedulePanels(); updateUndoButtons();
}
function commitChange(before) {
  if (snapshot() === before) { requestRender(); return false; }
  S.undo.push(before);
  if (S.undo.length > 200) S.undo.shift();
  S.redo.length = 0;
  afterEdit();
  return true;
}
function mutate(fn) {
  const before = snapshot();
  fn();
  normalizeCircuit(S.circ);
  return commitChange(before);
}
function restore(json) {
  S.circ = JSON.parse(json);
  S.sel.clear(); S.selWire = null; S.pending = null;
  S.geoVer++; S.editVer++;
  scheduleSave(); requestRender(); schedulePanels(); updateSelTools(); updateUndoButtons();
}
function undo() { if (!S.undo.length) return; S.redo.push(snapshot()); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); restore(S.redo.pop()); }
function updateUndoButtons() { $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length; }

/* ---------- 元件操作 ---------- */
function typeAllowed(t) { return !(S.asg && S.asg.allowed && isGate(t) && !S.asg.allowed.includes(t)); }
function addComp(type, wx, wy) {
  if (!typeAllowed(type)) { toast(`本題不能使用 ${type}（只能用 ${S.asg.allowed.join('、')}）`, 'warn'); return null; }
  const c = makeComp(type, S.circ), g = geom(c);
  c.x = snap(wx - g.w / 2); c.y = snap(wy - g.h / 2);
  mutate(() => { S.circ.comps.push(c); });
  S.sel = new Set([c.id]); S.selWire = null;
  updateSelTools();
  if (type === 'NOTE') focusSelInput();
  return c;
}
function addCompAtCenter(type) {
  const r = boardRect();
  let x = (r.width / 2 - S.view.x) / S.view.k + (Math.floor(Math.random() * 9) - 4) * GRID;
  let y = (r.height / 2 - S.view.y) / S.view.k + (Math.floor(Math.random() * 7) - 3) * GRID;
  const g = geom({ type, n: 2, text: '註解' });
  const hit = (cx, cy) => S.circ.comps.some(c => {
    const h = geom(c), ax = cx - g.w / 2, ay = cy - g.h / 2;
    return ax < c.x + h.w + 16 && ax + g.w + 16 > c.x && ay < c.y + h.h + 16 && ay + g.h + 16 > c.y;
  });
  for (let t = 0; t < 16 && hit(x, y); t++) { y += g.h + 20; if (t === 7) { x += 130; y -= 8 * (g.h + 20); } }
  return addComp(type, x, y);
}
function toggleComp(id) {
  const c = byId(id);
  if (!c) return;
  if (c.type === 'IN') setInputValue(id, c.val ? 0 : 1);
  else if (c.type === 'CONST') { mutate(() => { c.val = c.val ? 0 : 1; }); updateSelTools(); }
}
function setInputValue(id, v) {
  const c = byId(id);
  if (!c || c.type !== 'IN') return;
  c.val = v ? 1 : 0;
  scheduleSave(); requestRender(); schedulePanels();
}
function renameComp(id, raw) {
  const c = byId(id);
  if (!c || c.fixed) return;
  if (c.type === 'NOTE') {
    const text = String(raw || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || '註解';
    mutate(() => { c.text = text; });
    return;
  }
  const name = cleanLabel(raw);
  if (!name) { toast('名稱不可以空白', 'warn'); updateSelTools(); return; }
  const dup = S.circ.comps.some(o => o !== c && (o.type === 'IN' || o.type === 'OUT') && String(o.label).toLowerCase() === name.toLowerCase());
  if (dup) { toast(`名稱「${name}」已經有其他輸入／輸出使用了`, 'warn'); updateSelTools(); return; }
  mutate(() => { c.label = name; });
  updateSelTools();
}
function changeType(id, t) {
  const c = byId(id);
  if (!c || !isGate(t) || c.type === t) return;
  if (!typeAllowed(t)) { toast(`本題不能使用 ${t}`, 'warn'); updateSelTools(); return; }
  mutate(() => {
    const wasMulti = isMulti(c.type);
    c.type = t;
    if (isMulti(t)) { if (!wasMulti) c.n = 2; } else delete c.n;
  });
  updateSelTools();
}
function setGateInputs(id, n) {
  const c = byId(id);
  if (!c || !isMulti(c.type)) return;
  const max = Math.min(GATES[c.type].max, (S.asg && S.asg.maxFanIn) || 99);
  n = clamp(n, 2, Math.max(2, max));
  mutate(() => { c.n = n; });
  updateSelTools();
}
function deleteSelection() {
  if (S.selWire) {
    const id = S.selWire;
    S.selWire = null;
    mutate(() => { S.circ.wires = S.circ.wires.filter(w => w.id !== id); });
    updateSelTools();
    return;
  }
  if (!S.sel.size) return;
  const ids = new Set([...S.sel].filter(id => { const c = byId(id); return c && !c.fixed; }));
  const skipped = S.sel.size - ids.size;
  if (ids.size) {
    mutate(() => {
      S.circ.comps = S.circ.comps.filter(c => !ids.has(c.id));
      S.circ.wires = S.circ.wires.filter(w => !ids.has(w.from) && !ids.has(w.to));
    });
  }
  if (skipped) toast('題目指定的輸入／輸出不能刪除', 'warn');
  S.sel = new Set([...S.sel].filter(id => !ids.has(id) && byId(id)));
  updateSelTools(); requestRender();
}
function copySel(silent) {
  const comps = S.circ.comps.filter(c => S.sel.has(c.id));
  if (!comps.length) return false;
  const ids = new Set(comps.map(c => c.id));
  S.clip = JSON.stringify({ comps, wires: S.circ.wires.filter(w => ids.has(w.from) && ids.has(w.to)) });
  if (!silent) toast(`已複製 ${comps.length} 個元件（Ctrl+V 貼上）`);
  return true;
}
function pasteClip() {
  if (!S.clip) return;
  const { comps, wires } = JSON.parse(S.clip);
  const map = new Map(), added = [];
  mutate(() => {
    for (const c0 of comps) {
      if (!typeAllowed(c0.type)) continue;
      const c = Object.assign({}, c0, { id: nextId('c'), x: c0.x + 40, y: c0.y + 40 });
      delete c.fixed;
      if (c.type === 'IN' || c.type === 'OUT') c.label = nextLabel(S.circ, c.type);
      S.circ.comps.push(c);
      map.set(c0.id, c.id);
      added.push(c.id);
    }
    for (const w of wires) if (map.has(w.from) && map.has(w.to)) S.circ.wires.push({ id: nextId('w'), from: map.get(w.from), to: map.get(w.to), pin: w.pin });
  });
  S.clip = JSON.stringify({ comps: comps.map(c => Object.assign({}, c, { x: c.x + 40, y: c.y + 40 })), wires });
  S.sel = new Set(added); S.selWire = null;
  updateSelTools(); requestRender();
}
function duplicateSel() { if (copySel(true)) pasteClip(); }
function selectAll() { S.sel = new Set(S.circ.comps.map(c => c.id)); S.selWire = null; updateSelTools(); requestRender(); }
function nudge(dx, dy) {
  if (!S.sel.size) return;
  mutate(() => { for (const id of S.sel) { const c = byId(id); if (c) { c.x += dx; c.y += dy; } } });
}

/* ---------- 接腳與連線 ---------- */
function parsePin(key) { const i = key.lastIndexOf(':'), s = key.slice(i + 1); return { cid: key.slice(0, i), isOut: s === 'o', pin: s === 'o' ? -1 : parseInt(s, 10) }; }
function pinKey(p) { return p.cid + ':' + (p.isOut ? 'o' : p.pin); }
function pinWorld(p) { const c = byId(p.cid); return c ? pinPos(c, p.isOut ? -1 : p.pin) : [0, 0]; }
function findPinNear(wx, wy, wantOut, excludeCid, radius) {
  let best = null, bd = radius * radius;
  for (const c of S.circ.comps) {
    if (c.id === excludeCid) continue;
    const g = geom(c);
    if (wantOut) {
      if (!g.out) continue;
      const dx = c.x + g.out[0] - wx, dy = c.y + g.out[1] - wy, d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = { cid: c.id, pin: -1, isOut: true }; }
    } else {
      g.ins.forEach((p, i) => {
        const dx = c.x + p[0] - wx, dy = c.y + p[1] - wy, d = dx * dx + dy * dy;
        if (d <= bd) { bd = d; best = { cid: c.id, pin: i, isOut: false }; }
      });
    }
  }
  return best;
}
function findTarget(from, cur) { return findPinNear(cur.x, cur.y, !from.isOut, from.cid, 20 / S.view.k); }
function connectPins(a, b) {
  if (a.isOut === b.isOut) return false;
  const src = a.isOut ? a : b, dst = a.isOut ? b : a;
  if (src.cid === dst.cid) { toast('不能把元件的輸出接回自己的輸入', 'warn'); return false; }
  const cur = S.circ.wires.find(w => w.to === dst.cid && w.pin === dst.pin);
  if (cur && cur.from === src.cid) return false;
  mutate(() => {
    S.circ.wires = S.circ.wires.filter(w => !(w.to === dst.cid && w.pin === dst.pin));
    S.circ.wires.push({ id: nextId('w'), from: src.cid, to: dst.cid, pin: dst.pin });
  });
  if (compile(S.circ).cyc.size) toast('注意：這條線讓電路形成迴路', 'warn');
  return true;
}
function cancelPending() { if (S.pending) { S.pending = null; requestRender(); } }

/* ---------- 指標事件 ---------- */
function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button > 2) return;
  S.rect = null;
  try { board.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.pointers.size === 2) { startPinch(); return; }
  if (S.pointers.size > 2) return;
  closeMenus();
  const w = toWorld(e.clientX, e.clientY);
  if (e.button === 1 || e.button === 2) { startPan(e); return; }
  const t = e.target instanceof Element ? e.target : null;
  const pinEl = t && t.closest('[data-pin]');
  if (pinEl) {
    const p = parsePin(pinEl.getAttribute('data-pin'));
    if (S.pending) {
      const from = S.pending.from;
      S.pending = null;
      if (from.isOut !== p.isOut && from.cid !== p.cid) { connectPins(from, p); S.mode = null; requestRender(); return; }
    }
    S.wiring = { from: p, sx: e.clientX, sy: e.clientY, cur: w, hot: null, moved: false };
    S.mode = 'wire';
    requestRender();
    return;
  }
  const compEl = t && t.closest('[data-comp]');
  if (compEl) {
    cancelPending();
    const id = compEl.getAttribute('data-comp');
    const toggle = !!t.closest('[data-toggle]');
    S.selWire = null;
    if (e.shiftKey && !toggle) {
      if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id);
      updateSelTools(); requestRender();
      return;
    }
    const wasSelected = S.sel.has(id);
    if (!wasSelected && !toggle) { S.sel = new Set([id]); updateSelTools(); }
    S.drag = { id, sx: e.clientX, sy: e.clientY, moved: false, toggle, wasSelected };
    S.mode = 'drag';
    requestRender();
    return;
  }
  const wireEl = t && t.closest('[data-wire]');
  if (wireEl) {
    cancelPending();
    S.sel.clear();
    S.selWire = wireEl.getAttribute('data-wire');
    updateSelTools(); requestRender();
    return;
  }
  cancelPending();
  if (e.shiftKey) { S.box = { x0: w.x, y0: w.y, x1: w.x, y1: w.y }; S.mode = 'box'; return; }
  startPan(e);
}
function startPan(e) { S.pan = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; S.mode = 'pan'; }
function startPinch() {
  if (S.drag && S.drag.moved) commitChange(S.drag.before);
  S.mode = null; S.drag = null; S.wiring = null; S.pan = null; S.box = null;
  const [a, b] = [...S.pointers.values()], r = boardRect();
  S.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: S.view.k, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, vx: S.view.x, vy: S.view.y };
  requestRender();
}
function onPointerMove(e) {
  if (S.pointers.has(e.pointerId)) S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.pinch) {
    if (S.pointers.size < 2) return;
    const [a, b] = [...S.pointers.values()], r = boardRect(), p = S.pinch;
    const k = clamp(p.k0 * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / p.d0, 0.25, 3);
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    const wx = (p.mx - p.vx) / p.k0, wy = (p.my - p.vy) / p.k0;
    S.view.k = k; S.view.x = mx - wx * k; S.view.y = my - wy * k;
    applyView();
    return;
  }
  switch (S.mode) {
    case 'wire': {
      const wr = S.wiring;
      wr.cur = toWorld(e.clientX, e.clientY);
      if (!wr.moved && Math.hypot(e.clientX - wr.sx, e.clientY - wr.sy) > 4) wr.moved = true;
      wr.hot = wr.moved ? findTarget(wr.from, wr.cur) : null;
      requestRender();
      return;
    }
    case 'drag': {
      const d = S.drag, dxs = e.clientX - d.sx, dys = e.clientY - d.sy;
      if (!d.moved) {
        if (Math.hypot(dxs, dys) < 4) return;
        d.moved = true;
        if (!S.sel.has(d.id)) { S.sel = new Set([d.id]); updateSelTools(); }
        d.before = snapshot();
        d.orig = [];
        for (const id of S.sel) { const c = byId(id); if (c) d.orig.push([c, c.x, c.y]); }
      }
      const dx = dxs / S.view.k, dy = dys / S.view.k;
      for (const [c, x0, y0] of d.orig) {
        if (c.type === 'NOTE') { c.x = Math.round(x0 + dx); c.y = Math.round(y0 + dy); }
        else { c.x = snap(x0 + dx); c.y = snap(y0 + dy); }
      }
      S.geoVer++;
      requestRender();
      return;
    }
    case 'pan': {
      const p = S.pan, dx = e.clientX - p.sx, dy = e.clientY - p.sy;
      if (!p.moved && Math.hypot(dx, dy) > 3) { p.moved = true; board.classList.add('panning'); }
      if (p.moved) { S.view.x = p.vx + dx; S.view.y = p.vy + dy; applyView(); }
      return;
    }
    case 'box': {
      const w = toWorld(e.clientX, e.clientY);
      S.box.x1 = w.x; S.box.y1 = w.y;
      requestRender();
      return;
    }
  }
  if (S.pending) {
    S.pending.cur = toWorld(e.clientX, e.clientY);
    S.pending.hot = findTarget(S.pending.from, S.pending.cur);
    requestRender();
  }
}
function onPointerUp(e) {
  S.pointers.delete(e.pointerId);
  if (S.pinch) { if (S.pointers.size < 2) S.pinch = null; S.mode = null; return; }
  const mode = S.mode;
  S.mode = null;
  if (mode === 'wire') {
    const wr = S.wiring;
    S.wiring = null;
    if (wr.moved) {
      const target = wr.hot || findTarget(wr.from, toWorld(e.clientX, e.clientY));
      if (target) connectPins(wr.from, target);
    } else {
      S.pending = { from: wr.from, cur: toWorld(e.clientX, e.clientY), hot: null };
    }
    requestRender();
    return;
  }
  if (mode === 'drag') {
    const d = S.drag;
    S.drag = null;
    if (d.moved) commitChange(d.before);
    else if (d.toggle) toggleComp(d.id);
    else if (d.wasSelected && S.sel.size > 1 && !e.shiftKey) { S.sel = new Set([d.id]); updateSelTools(); }
    requestRender();
    return;
  }
  if (mode === 'pan') {
    board.classList.remove('panning');
    if (!S.pan.moved && (S.sel.size || S.selWire)) { S.sel.clear(); S.selWire = null; updateSelTools(); requestRender(); }
    S.pan = null;
    return;
  }
  if (mode === 'box') {
    const b = normBox(S.box);
    S.box = null;
    for (const c of S.circ.comps) {
      const g = geom(c);
      if (c.x < b.x2 && c.x + g.w > b.x1 && c.y < b.y2 && c.y + g.h > b.y1) S.sel.add(c.id);
    }
    S.selWire = null;
    updateSelTools(); requestRender();
  }
}
function onPointerCancel(e) {
  S.pointers.delete(e.pointerId);
  if (S.drag && S.drag.moved) commitChange(S.drag.before);
  S.mode = null; S.drag = null; S.wiring = null; S.pan = null; S.box = null;
  if (S.pointers.size < 2) S.pinch = null;
  board.classList.remove('panning');
  requestRender();
}
function onWheel(e) {
  e.preventDefault();
  S.rect = null;
  const r = boardRect();
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= 400;
  zoomAt(e.clientX - r.left, e.clientY - r.top, S.view.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
}
function onDblClick(e) {
  const t = e.target instanceof Element ? e.target : null;
  const compEl = t && t.closest('[data-comp]');
  if (!compEl) return;
  const c = byId(compEl.getAttribute('data-comp'));
  if (!c || !(c.type === 'IN' || c.type === 'OUT' || c.type === 'NOTE')) return;
  if (t.closest('[data-toggle]')) return;
  S.sel = new Set([c.id]); S.selWire = null;
  updateSelTools(); requestRender();
  focusSelInput();
}
function focusSelInput() {
  const inp = selTools.querySelector('input[type="text"]');
  if (inp && !inp.disabled) { inp.focus(); inp.select(); }
}
function onKeyDown(e) {
  if (document.querySelector('dialog[open]')) return;
  if (isTyping(e.target)) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (mod && k === 'y') { e.preventDefault(); redo(); }
  else if (mod && k === 'c') { if (copySel()) e.preventDefault(); }
  else if (mod && k === 'v') { if (S.clip) { e.preventDefault(); pasteClip(); } }
  else if (mod && k === 'd') { e.preventDefault(); duplicateSel(); }
  else if (mod && k === 'a') { e.preventDefault(); selectAll(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (S.sel.size || S.selWire) { e.preventDefault(); deleteSelection(); } }
  else if (e.key === 'Escape') {
    closeMenus();
    if (S.pending || S.wiring) { S.pending = null; S.wiring = null; S.mode = null; requestRender(); }
    else if (S.sel.size || S.selWire) { S.sel.clear(); S.selWire = null; updateSelTools(); requestRender(); }
  } else if (S.sel.size && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const s = GRID * (e.shiftKey ? 4 : 1);
    nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
  }
}

/* ---------- 選取工具列 ---------- */
function stepper(val, min, max, onChange) {
  return el('span', { class: 'stepper' },
    el('button', { type: 'button', 'aria-label': '減少輸入數', disabled: val <= min, onclick: () => onChange(val - 1) }, '−'),
    el('span', { 'aria-live': 'polite' }, String(val)),
    el('button', { type: 'button', 'aria-label': '增加輸入數', disabled: val >= max, onclick: () => onChange(val + 1) }, '+'));
}
function updateSelTools() {
  const box = selTools;
  box.innerHTML = '';
  const sep = () => el('span', { class: 'st-sep' });
  const del = () => el('button', { type: 'button', class: 'btn btn-danger', onclick: deleteSelection, title: '刪除（Delete）' }, '刪除');
  if (S.selWire && !S.sel.size) {
    box.append(el('span', { class: 'st-name' }, '導線'), sep(), del());
    box.hidden = false;
    return;
  }
  if (!S.sel.size) { box.hidden = true; return; }
  if (S.sel.size > 1) {
    box.append(el('span', { class: 'st-name' }, `已選取 ${S.sel.size} 個元件`), sep(),
      el('button', { type: 'button', class: 'btn', onclick: duplicateSel, title: 'Ctrl+D' }, '再製一份'), del());
    box.hidden = false;
    return;
  }
  const c = byId([...S.sel][0]);
  if (!c) { box.hidden = true; return; }
  if (isGate(c.type)) {
    const sel = el('select', { 'aria-label': '閘的種類' });
    for (const t of GATE_ORDER) {
      if (!typeAllowed(t) && t !== c.type) continue;
      const o = el('option', { value: t }, `${t} ${GATES[t].zh}`);
      if (t === c.type) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => changeType(c.id, sel.value));
    box.append(sel);
    if (isMulti(c.type)) {
      const max = Math.min(GATES[c.type].max, (S.asg && S.asg.maxFanIn) || 99);
      box.append(el('span', { class: 'st-sub' }, '輸入數'), stepper(nIns(c), 2, Math.max(2, max), v => setGateInputs(c.id, v)));
    }
    box.append(sep(), del());
  } else if (c.type === 'IN' || c.type === 'OUT' || c.type === 'NOTE') {
    const isNote = c.type === 'NOTE';
    box.append(el('span', { class: 'st-name' }, typeName(c.type)));
    const inp = el('input', { type: 'text', value: isNote ? c.text : c.label, maxlength: isNote ? 80 : 12, 'aria-label': isNote ? '註解文字' : '名稱', class: isNote ? 'wide' : null, disabled: !!c.fixed });
    inp.addEventListener('change', () => renameComp(c.id, inp.value));
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') inp.blur();
      else if (ev.key === 'Escape') { inp.value = isNote ? c.text : c.label; inp.blur(); }
    });
    if (!isNote) box.append(el('span', { class: 'st-sub' }, '名稱'));
    box.append(inp);
    if (c.type === 'IN') box.append(el('button', { type: 'button', class: 'btn', onclick: () => toggleComp(c.id) }, '切換 0／1'));
    if (c.fixed) box.append(el('span', { class: 'lock', title: '題目指定的輸入／輸出不能刪除或改名，但可以移動' }, '題目指定'));
    else box.append(sep(), del());
  } else if (c.type === 'CONST') {
    box.append(el('span', { class: 'st-name' }, '常數'),
      el('button', { type: 'button', class: 'btn', onclick: () => toggleComp(c.id) }, `目前 = ${c.val ? 1 : 0}（點我切換）`), sep(), del());
  }
  box.hidden = false;
}

/* ---------- 元件列 ---------- */
function buildPalette() {
  const pal = $('#palette');
  pal.innerHTML = '';
  const iec = S.settings.symbol === 'iec';
  const groups = [['輸入／輸出', ['IN', 'OUT', 'CONST']], ['邏輯閘', GATE_ORDER], ['其他', ['NOTE']]];
  for (const [title, types] of groups) {
    pal.append(el('div', { class: 'pal-title' }, title));
    for (const t of types) {
      const tip = isGate(t) ? `${t} ${GATES[t].zh}：${GATES[t].desc}（${GATES[t].expr}）` : `${SPECIAL[t].name}：${SPECIAL[t].desc}`;
      const b = el('button', { type: 'button', class: 'pal-item', 'data-type': t, title: tip, 'aria-label': tip,
        html: iconSVG(t, iec) + `<span class="pal-name">${esc(typeName(t))}</span><span class="pal-zh">${esc(typeZh(t))}</span>` });
      b.addEventListener('pointerdown', e => startPaletteDrag(t, e, b));
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addCompAtCenter(t); } });
      pal.append(b);
    }
  }
  updatePaletteState();
}
function updatePaletteState() {
  for (const b of $$('.pal-item')) b.setAttribute('aria-disabled', typeAllowed(b.dataset.type) ? 'false' : 'true');
}
function startPaletteDrag(type, e, btn) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (!typeAllowed(type)) { toast(`本題不能使用 ${type}（只能用 ${S.asg.allowed.join('、')}）`, 'warn'); return; }
  const st = { x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const ghost = $('#ghost');
  const move = ev => {
    if (ev.pointerId !== st.id) return;
    if (!st.moved && Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > 6) {
      st.moved = true;
      ghost.innerHTML = iconSVG(type, S.settings.symbol === 'iec');
      ghost.hidden = false;
    }
    if (st.moved) ghost.style.transform = `translate(${ev.clientX - 45}px, ${ev.clientY - 25}px)`;
  };
  const finish = (ev, cancelled) => {
    if (ev.pointerId !== st.id) return;
    btn.removeEventListener('pointermove', move);
    btn.removeEventListener('pointerup', up);
    btn.removeEventListener('pointercancel', cancel);
    ghost.hidden = true;
    if (cancelled) return;
    if (st.moved) {
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (under && board.contains(under)) { S.rect = null; const w = toWorld(ev.clientX, ev.clientY); addComp(type, w.x, w.y); }
    } else addCompAtCenter(type);
  };
  const up = ev => finish(ev, false), cancel = ev => finish(ev, true);
  btn.addEventListener('pointermove', move);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', cancel);
}
