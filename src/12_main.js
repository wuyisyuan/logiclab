/* ============================================================
 * 12 儲存、題目切換、選單與啟動
 * ============================================================ */
let saveTimer = 0;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveWork, 400); }
function saveWork() {
  clearTimeout(saveTimer); saveTimer = 0;
  if (!S.key) return;
  store.set('work.' + S.key, { c: toCompact(S.circ), meta: S.meta, t: Date.now() });
}
function noteEdit() {
  const now = Date.now();
  if (!S.meta.createdAt) S.meta.createdAt = new Date(now).toISOString();
  if (S.meta.lastEdit) S.meta.activeSec += Math.min(60, Math.max(0, (now - S.meta.lastEdit) / 1000));
  S.meta.lastEdit = now;
  S.meta.edits++;
}
function saveSettings() { store.set('settings', S.settings); }
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function syncMenus() {
  for (const b of $$('#menuView [data-set]')) {
    const k = b.dataset.set;
    b.setAttribute('aria-checked', String(b.dataset.val != null ? S.settings[k] === b.dataset.val : !!S.settings[k]));
  }
}
function closeMenus() {
  for (const m of $$('.menu')) m.hidden = true;
  for (const b of $$('.menu-wrap > .btn')) b.setAttribute('aria-expanded', 'false');
}
function toggleMenu(btn, menu) {
  const open = menu.hidden;
  closeMenus();
  if (open) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); syncMenus(); }
}
function setPanelOpen(open) {
  $('#panel').classList.toggle('open', open);
  const b = $('#panelToggle');
  b.setAttribute('aria-expanded', String(open));
  b.textContent = open ? '收合面板' : '題目／真值表';
}
function openPanelOnMobile() { if (window.matchMedia && matchMedia('(max-width: 860px)').matches) setPanelOpen(true); }

/* ---------- 題目切換 ---------- */
function rememberCustom(a, code) {
  store.set('hw.' + a.hash, { code, title: a.title, t: Date.now() });
  store.keys('hw.').map(k => ({ k, t: (store.get(k) || {}).t || 0 })).sort((x, y) => y.t - x.t).slice(12).forEach(x => store.del(x.k));
}
function buildTaskSelect() {
  const sel = $('#taskSelect');
  sel.innerHTML = '';
  if (S.key === 'review' && S.reviewLabel) sel.append(el('option', { value: 'review' }, S.reviewLabel));
  sel.append(el('option', { value: 'free' }, '自由練習（不限題目）'));
  const customs = store.keys('hw.').map(k => ({ hash: k.slice(3), v: store.get(k) })).filter(x => x.v && x.v.code).sort((a, b) => (b.v.t || 0) - (a.v.t || 0));
  if (customs.length) {
    const g = el('optgroup', { label: '老師指定作業' });
    customs.forEach(x => g.append(el('option', { value: 'hw:' + x.hash }, x.v.title || '作業')));
    sel.append(g);
  }
  const groups = new Map();
  for (const a of BUILTIN.values()) { const k = a.group || '練習題'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  let n = 0;
  for (const [k, list] of groups) {
    const g = el('optgroup', { label: k });
    for (const a of list) { n++; g.append(el('option', { value: 'ex:' + a.id }, `${n}. ${a.title}${a.level ? `（${LEVELS[a.level]}）` : ''}`)); }
    sel.append(g);
  }
  syncTaskSelect();
}
function syncTaskSelect() {
  const sel = $('#taskSelect'), want = S.key || 'free';
  if ([...sel.options].some(o => o.value === want)) sel.value = want;
}
function openAssignment(a, key) {
  if (S.key) saveWork();
  stopPlay();
  S.asg = a || null;
  S.key = key;
  if (key !== 'review') S.reviewLabel = null;
  S.lastCheck = null; S.checkVer = -1;
  S.undo = []; S.redo = [];
  S.sel.clear(); S.selWire = null; S.pending = null; S.wiring = null; S.mode = null;
  const saved = store.get('work.' + key, null);
  if (saved && saved.c) {
    S.circ = fromCompact(saved.c);
    S.meta = Object.assign(freshMeta(), saved.meta || {});
  } else {
    S.circ = a ? starterCircuit(a) : newCircuit();
    S.meta = freshMeta();
  }
  if (a) ensureStarter(S.circ, a);
  S.geoVer++; S.editVer++;
  S.timing.seq = {}; S.timing.cursor = -1;
  if (key !== 'review') store.set('last', key);
  buildTaskSelect();
  updatePaletteState(); updateSelTools(); updateUndoButtons();
  requestRender();
  if (S.tab === 'submit' && a) setTab('task'); else renderPanels();
  requestAnimationFrame(fitView);
}
async function openAssignmentObject(a) {
  if (a.builtin) {
    openAssignment(a, 'ex:' + a.id);
    history.replaceState(null, '', siteBase() + '#ex=' + a.id);
  } else {
    const code = await packCode(ASG_PREFIX, compactAssignment(a, true));
    rememberCustom(a, code);
    openAssignment(a, 'hw:' + a.hash);
    history.replaceState(null, '', siteBase() + '#hw=' + code);
  }
}
async function route(initial) {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  const hw = q.get('hw'), ex = q.get('ex');
  if (hw) {
    try {
      const a = expandAssignment(await unpackCode(hw, ASG_PREFIX));
      rememberCustom(a, hw);
      openAssignment(a, 'hw:' + a.hash);
      if (initial) toast(`已載入老師指定的作業：${a.title}`, 'ok', 3500);
      return;
    } catch (e) { toast('作業連結無法開啟：' + e.message, 'err', 6000); }
  } else if (ex) {
    const a = BUILTIN.get(ex);
    if (a) { openAssignment(a, 'ex:' + a.id); return; }
    toast('找不到題目：' + ex, 'warn');
  } else if (initial) {
    const last = store.get('last', null);
    if (last && last.startsWith('ex:') && BUILTIN.has(last.slice(3))) {
      history.replaceState(null, '', siteBase() + '#ex=' + last.slice(3));
      openAssignment(BUILTIN.get(last.slice(3)), last);
      return;
    }
    if (last && last.startsWith('hw:')) {
      const v = store.get('hw.' + last.slice(3), null);
      if (v && v.code) { history.replaceState(null, '', siteBase() + '#hw=' + v.code); return route(false); }
    }
  }
  openAssignment(null, 'free');
}
function navigateHash(h) {
  if (location.hash.replace(/^#/, '') === h) route(false);
  else location.hash = h;
}

/* ---------- 綁定介面 ---------- */
function bindUI() {
  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerCancel);
  board.addEventListener('wheel', onWheel, { passive: false });
  board.addEventListener('dblclick', onDblClick);
  board.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('pointerdown', e => { if (!(e.target instanceof Element) || !e.target.closest('.menu-wrap')) closeMenus(); });

  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnFile').addEventListener('click', () => toggleMenu($('#btnFile'), $('#menuFile')));
  $('#btnView').addEventListener('click', () => toggleMenu($('#btnView'), $('#menuView')));
  $('#menuFile').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    closeMenus();
    const acts = { new: resetCanvas, open: () => $('#fileOpen').click(), save: saveCircuitFile, png: () => exportPNG(false), copyimg: copyImage };
    if (acts[b.dataset.act]) acts[b.dataset.act]();
  });
  $('#menuView').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'fit') { closeMenus(); fitView(); return; }
    const k = b.dataset.set;
    if (!k) return;
    S.settings[k] = b.dataset.val != null ? b.dataset.val : !S.settings[k];
    saveSettings(); syncMenus(); closeMenus();
    if (k === 'theme') applyTheme();
    if (k === 'symbol') buildPalette();
    S.route = null;
    requestRender(); renderPanels();
  });
  $('#fileOpen').addEventListener('change', e => { const f = e.target.files[0]; if (f) openCircuitFile(f); e.target.value = ''; });
  $('#btnHelp').addEventListener('click', () => $('#dlgHelp').showModal());
  $('#btnTeacher').addEventListener('click', () => openTeacher());
  for (const b of $$('[data-close]')) b.addEventListener('click', () => b.closest('dialog').close());
  for (const d of $$('dialog')) d.addEventListener('click', e => { if (e.target === d) d.close(); });
  for (const b of $$('.panel .tabs [role="tab"]')) b.addEventListener('click', () => setTab(b.dataset.tab));
  $('#panelToggle').addEventListener('click', () => setPanelOpen(!$('#panel').classList.contains('open')));
  $('#taskSelect').addEventListener('change', e => {
    const v = e.target.value;
    if (v === 'free') navigateHash('');
    else if (v.startsWith('ex:')) navigateHash('ex=' + v.slice(3));
    else if (v.startsWith('hw:')) { const s = store.get('hw.' + v.slice(3), null); if (s && s.code) navigateHash('hw=' + s.code); }
  });
  $('#zoomCtl').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const z = b.dataset.zoom, r = boardRect();
    if (z === 'in') zoomBy(1.2);
    else if (z === 'out') zoomBy(1 / 1.2);
    else if (z === 'reset') zoomAt(r.width / 2, r.height / 2, 1);
    else if (z === 'fit') fitView();
  });
  $('#btnSubFile').addEventListener('click', downloadSubmission);
  $('#btnSubCode').addEventListener('click', copySubmissionCode);
  $('#btnSubPng').addEventListener('click', () => exportPNG(true));
  for (const id of ['#stuId', '#stuName']) {
    $(id).addEventListener('input', () => { store.set('student', readStudent()); $('#stuErr').hidden = true; });
  }
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => { if (S.settings.theme === 'auto') { requestRender(); renderPanels(); } };
    if (mq.addEventListener) mq.addEventListener('change', onTheme); else if (mq.addListener) mq.addListener(onTheme);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveWork(); });
  window.addEventListener('pagehide', saveWork);
  window.addEventListener('hashchange', () => route(false));
  if (window.ResizeObserver) new ResizeObserver(() => { S.rect = null; applyView(); }).observe(boardWrap);
  else window.addEventListener('resize', () => { S.rect = null; applyView(); });
}

/* ---------- 測試與除錯用介面 ---------- */
window.LogicLab = {
  version: APP.version,
  state: S,
  circuit: () => toCompact(S.circ),
  load: o => replaceCircuit(fromCompact(o)),
  check: () => {
    if (!S.asg) return null;
    const r = checkCircuit(S.asg, S.circ);
    return { pass: r.pass, correct: r.correct, total: r.total, errors: r.errors, violations: r.violations, warnings: r.warnings, gateCount: r.gateCount };
  },
  truthTable: () => {
    const t = truthTable(S.circ, S.asg);
    return { ins: t.ins.map(c => c.label), outs: t.outs.map(c => c.label), rows: t.rows.map(r => [r.ins.join(''), r.outs.map(v => v === 1 ? '1' : v === 0 ? '0' : 'x').join('')]) };
  },
  expressions: () => circuitExpressions(S.circ, S.asg),
  specToTT: (s, vars) => specToTT(s, vars),
  exercises: () => [...BUILTIN.values()].map(a => ({ id: a.id, title: a.title, inputs: a.inputs, outputs: a.outputs.map(o => ({ name: o.name, tt: o.tt })), allowed: a.allowed, maxGates: a.maxGates, maxFanIn: a.maxFanIn })),
  builtinErrors: () => BUILTIN_ERRORS.slice(),
  submission: (id, name) => buildSubmission({ id, name }),
  submissionCode: (id, name) => packCode(SUB_PREFIX, buildSubmission({ id, name })),
  unpack: (code, prefix) => unpackCode(code, prefix || SUB_PREFIX),
  routes: () => { const r = S.route && S.route.r; return r ? { paths: [...r.paths.entries()].map(([k, v]) => [k, v.pts || v.d]), dots: r.dots } : null; },
  view: () => Object.assign({}, S.view),
  key: () => S.key,
  fit: () => fitView()
};

async function boot() {
  initDom();
  applyTheme();
  $('#courseName').textContent = CFG.courseName || '';
  $('#aboutLine').textContent = `LogicLab v${APP.version}　·　純前端網頁，所有資料只存在你的瀏覽器`;
  const st = store.get('student', null);
  if (st) { $('#stuId').value = st.id || ''; $('#stuName').value = st.name || ''; }
  buildPalette();
  bindUI();
  bindTeacher();
  syncMenus();
  updateUndoButtons();
  buildTaskSelect();
  S.rect = null;
  applyView();
  await route(true);
  S.booted = true;
  document.documentElement.classList.add('ready');
  if (BUILTIN_ERRORS.length) toast(`exercises.js 有 ${BUILTIN_ERRORS.length} 題設定錯誤，請到「教師專區」查看`, 'warn', 6000);
}
boot();
