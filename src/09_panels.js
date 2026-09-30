/* ============================================================
 * 09 右側面板：題目、真值表、時序圖、繳交狀態
 * ============================================================ */
let panelTimer = 0;
function schedulePanels() { clearTimeout(panelTimer); panelTimer = setTimeout(renderPanels, 60); }
function renderPanels() {
  clearTimeout(panelTimer);
  switch (S.tab) {
    case 'task': renderTaskPane(); break;
    case 'table': renderTablePane(); break;
    case 'timing': renderTimingPane(); break;
    case 'submit': renderSubmitStatus(); break;
  }
}
function setTab(name) {
  if (S.tab === 'timing' && name !== 'timing') stopPlay();
  S.tab = name;
  for (const b of $$('.panel .tabs [role="tab"]')) b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false');
  for (const p of $$('.panel .pane')) p.hidden = p.id !== 'pane-' + name;
  renderPanels();
}

/* ---------- 題目 ---------- */
const EXAMPLES = [
  {
    title: "F = AB + C'（AND、OR、NOT）",
    build: () => ({ c: [['IN', 60, 60, 'A', 1, 0], ['IN', 60, 140, 'B', 1, 0], ['IN', 60, 220, 'C', 0, 0], ['AND', 240, 70, 2], ['NOT', 240, 220], ['OR', 400, 110, 2], ['OUT', 540, 110, 'F', 0]],
      w: [[0, 3, 0], [1, 3, 1], [2, 4, 0], [3, 5, 0], [4, 5, 1], [5, 6, 0]] })
  },
  {
    title: 'NAND-NAND 電路：F = AB + CD',
    build: () => ({ c: [['IN', 60, 60, 'A', 0, 0], ['IN', 60, 140, 'B', 0, 0], ['IN', 60, 220, 'C', 0, 0], ['IN', 60, 300, 'D', 0, 0], ['NAND', 240, 90, 2], ['NAND', 240, 250, 2], ['NAND', 400, 170, 2], ['OUT', 540, 170, 'F', 0]],
      w: [[0, 4, 0], [1, 4, 1], [2, 5, 0], [3, 5, 1], [4, 6, 0], [5, 6, 1], [6, 7, 0]] })
  },
  {
    title: '4 位元奇同位產生器：P = A ⊕ B ⊕ C ⊕ D',
    build: () => ({ c: [['IN', 60, 60, 'A', 0, 0], ['IN', 60, 140, 'B', 0, 0], ['IN', 60, 220, 'C', 0, 0], ['IN', 60, 300, 'D', 0, 0], ['XOR', 240, 90, 2], ['XOR', 240, 250, 2], ['XOR', 400, 170, 2], ['OUT', 540, 170, 'P', 0]],
      w: [[0, 4, 0], [1, 4, 1], [2, 5, 0], [3, 5, 1], [4, 6, 0], [5, 6, 1], [6, 7, 0]] })
  }
];
function loadExample(i) {
  const ex = EXAMPLES[i];
  if (!ex) return;
  replaceCircuit(fromCompact(ex.build()));
  toast('已載入範例（可按復原回到原本的電路）');
}
function targetTableHTML(a) {
  if (a.inputs.length > 6) return '<p class="note">輸入超過 6 個，真值表太長，請依題目說明作答。</p>';
  const head = a.inputs.map(n => `<th>${esc(n)}</th>`).join('') + a.outputs.map((o, j) => `<th${j === 0 ? ' class="sep"' : ''}>${esc(o.name)}</th>`).join('');
  let body = '';
  for (let r = 0; r < (1 << a.inputs.length); r++) {
    const bits = bitsOf(r, a.inputs.length);
    body += `<tr><td class="idx">${r}</td>` + bits.map(b => `<td>${b}</td>`).join('') +
      a.outputs.map((o, j) => { const v = o.tt[r]; return `<td class="${j === 0 ? 'sep ' : ''}${v === '1' ? 'v1' : v === 'x' ? 'vx' : ''}">${v === 'x' ? 'X' : v}</td>`; }).join('') + '</tr>';
  }
  return `<div class="tt-wrap"><table class="tt"><thead><tr><th class="idx">#</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    (a.outputs.some(o => o.tt.includes('x')) ? '<p class="note">X 表示無關項（輸出 0 或 1 都可以）。</p>' : '');
}
function renderTaskPane() {
  const pane = $('#pane-task'), a = S.asg;
  if (!a) {
    pane.innerHTML = `
      <div class="task-group">自由練習</div>
      <h2 class="task-title">自由繪製邏輯電路</h2>
      <div class="task-desc">
        <p>在畫布上任意組合邏輯閘，點輸入開關切換 0／1 觀察輸出。「真值表」分頁會即時列出所有輸入組合，並寫出電路的布林表示式；「時序圖」分頁可以看波形。</p>
      </div>
      <ul class="free-tips">
        <li>想做練習題：從上方<b>「題目」</b>選單選一題，完成後可以自動檢查。</li>
        <li>從元件<b>右側的小圓點</b>拖曳到另一個元件<b>左側的輸入端</b>就能連線。</li>
        <li>選取閘之後，上方工具列可以改輸入數、換成其他閘或刪除。</li>
      </ul>
      <h3 class="pane-title" style="font-size:16px">載入範例電路</h3>
      <div class="examples">${EXAMPLES.map((ex, i) => `<button class="btn" data-example="${i}">${esc(ex.title)}</button>`).join('')}</div>`;
    for (const b of $$('[data-example]', pane)) b.addEventListener('click', () => loadExample(+b.dataset.example));
    return;
  }
  const chips = [];
  if (a.level) chips.push(`<span class="chip lv${a.level}">${LEVELS[a.level]}</span>`);
  chips.push(`<span class="chip">輸入：${a.inputs.map(esc).join('、')}</span>`);
  chips.push(`<span class="chip">輸出：${a.outputs.map(o => esc(o.name)).join('、')}</span>`);
  for (const t of constraintText(a)) chips.push(`<span class="chip limit">${esc(t)}</span>`);
  const group = a.group || (a.builtin ? '' : '老師指定作業');
  pane.innerHTML = `
    ${group ? `<div class="task-group">${esc(group)}</div>` : ''}
    <h2 class="task-title">${esc(a.title)}</h2>
    <div class="chips">${chips.join('')}</div>
    <div class="task-desc">${a.html ? a.desc : escText(a.desc)}</div>
    <details class="box"${a.showTarget ? ' open' : ''}><summary>目標真值表</summary><div class="box-body">${targetTableHTML(a)}</div></details>
    ${a.hint ? `<details class="box"><summary>提示</summary><div class="box-body">${escText(a.hint)}</div></details>` : ''}
    <div class="task-actions">
      ${a.selfCheck ? '<button class="btn btn-check" id="btnCheck">檢查答案</button>' : ''}
      <button class="btn" id="btnResetTask" title="清除畫布，只留下題目的輸入與輸出">重新開始</button>
    </div>
    <div id="checkResult">${a.selfCheck ? checkResultHTML() : '<div class="result info">這份作業由老師批改，完成後請到「繳交」分頁繳交。</div>'}</div>`;
  const bc = $('#btnCheck', pane);
  if (bc) bc.addEventListener('click', runCheck);
  $('#btnResetTask', pane).addEventListener('click', resetCanvas);
  const see = $('#btnSeeRows', pane);
  if (see) see.addEventListener('click', () => setTab('table'));
}
function runCheck() {
  if (!S.asg) return;
  S.lastCheck = checkCircuit(S.asg, S.circ);
  S.checkVer = S.editVer;
  renderTaskPane();
  const r = S.lastCheck;
  if (r.pass) toast('✔ 通過！做得好', 'ok');
  else toast(`還沒通過：真值表正確 ${r.correct}/${r.total} 列`, 'err');
}
function checkResultHTML() {
  const res = S.lastCheck, a = S.asg;
  if (!res) return '<p class="note">完成電路後按「檢查答案」，系統會比對所有輸入組合。</p>';
  const stale = S.checkVer !== S.editVer ? '<div class="stale">電路已經修改，請再檢查一次</div>' : '';
  const list = arr => arr.length ? `<ul>${arr.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
  if (res.pass) {
    return `<div class="result pass"><div class="result-head">✔ 通過！</div>
      <div>真值表 ${res.total} 列全部正確，使用 ${res.gateCount} 個閘。</div>${list(res.warnings)}${stale}</div>`;
  }
  const wrong = res.rows.filter(r => !r.ok);
  const rowsHtml = wrong.length ? `<ul class="rowlist">${wrong.slice(0, 4).map(r => {
    const d = describeRow(a, r);
    return `<li>${esc(d.ins)}：應為 ${esc(d.exp)}，目前 ${esc(d.got)}</li>`;
  }).join('')}</ul>${wrong.length > 4 ? `<div class="small muted">……另外還有 ${wrong.length - 4} 列不對</div>` : ''}
    <button class="linkish" id="btnSeeRows">到真值表查看</button>` : '';
  return `<div class="result fail"><div class="result-head">✘ 還沒通過</div>
    ${list([...res.errors, ...res.violations])}
    <div>真值表正確 <b>${res.correct}</b> / ${res.total} 列</div>
    ${rowsHtml}${list(res.warnings)}${stale}</div>`;
}
function replaceCircuit(circ) {
  const before = snapshot();
  S.circ = circ;
  if (S.asg) ensureStarter(S.circ, S.asg);
  normalizeCircuit(S.circ);
  S.sel.clear(); S.selWire = null; S.pending = null;
  commitChange(before);
  updateSelTools();
  requestAnimationFrame(fitView);
}
function resetCanvas() {
  if (!S.circ.comps.some(c => !c.fixed)) { toast('畫布已經是空的'); return; }
  replaceCircuit(S.asg ? starterCircuit(S.asg) : newCircuit());
  toast('已清除（可按復原）');
}

/* ---------- 真值表 ---------- */
function renderTablePane() {
  const pane = $('#pane-table');
  const comp = compile(S.circ);
  const tt = truthTable(S.circ, S.asg, comp);
  if (!tt.ins.length) {
    pane.innerHTML = '<h2 class="pane-title">真值表</h2><p class="empty-note">還沒有輸入。請從左側拖曳「輸入」開關到畫布上。</p>';
    return;
  }
  if (tt.tooMany) {
    pane.innerHTML = `<h2 class="pane-title">真值表</h2><p class="empty-note">輸入有 ${tt.ins.length} 個，超過 ${MAX_TT_INPUTS} 個無法列出真值表。</p>`;
    return;
  }
  const a = S.asg;
  const insMatch = !!a && tt.ins.length === a.inputs.length && tt.ins.every((c, i) => String(c.label).toLowerCase() === a.inputs[i].toLowerCase());
  const canExp = !!a && a.selfCheck && insMatch;
  const showExp = canExp && S.settings.showExpected;
  const expCols = showExp ? tt.outs.map(c => a.outputs.find(o => o.name.toLowerCase() === String(c.label).toLowerCase()) || null) : [];
  const cur = tt.ins.reduce((acc, c) => (acc << 1) | (c.val ? 1 : 0), 0);
  const fmt = v => v === 1 ? '1' : v === 0 ? '0' : '?';
  let head = '<th class="idx">#</th>' + tt.ins.map(c => `<th>${esc(c.label)}</th>`).join('');
  head += tt.outs.map((c, j) => `<th class="${j === 0 ? 'sep' : ''}">${esc(c.label)}</th>`).join('');
  if (showExp) head += expCols.map((o, j) => o ? `<th class="exp${j === 0 ? ' sep' : ''}" title="題目要求的輸出">${esc(o.name)}<br><small>應為</small></th>` : '').join('');
  let body = '', bad = 0;
  for (const row of tt.rows.slice(0, TT_SHOW_ROWS)) {
    let mism = false;
    if (showExp) expCols.forEach((o, j) => { if (o) { const e = o.tt[row.r]; if (e !== 'x' && String(row.outs[j]) !== e) mism = true; } });
    if (mism) bad++;
    body += `<tr data-r="${row.r}" class="${row.r === cur ? 'cur' : ''}${mism ? ' bad' : ''}"><td class="idx">${row.r}</td>` +
      row.ins.map(b => `<td>${b}</td>`).join('') +
      row.outs.map((v, j) => `<td class="o ${j === 0 ? 'sep ' : ''}${v === 1 ? 'v1' : v === 0 ? '' : 'vx'}">${fmt(v)}</td>`).join('') +
      (showExp ? expCols.map((o, j) => o ? `<td class="exp${j === 0 ? ' sep' : ''}">${o.tt[row.r] === 'x' ? 'X' : o.tt[row.r]}</td>` : '').join('') : '') + '</tr>';
  }
  const exprs = circuitExpressions(S.circ, S.asg, comp);
  const exprHtml = tt.outs.length ? exprs.map((e, j) => {
    const col = tt.rows.map(r => r.outs[j] === 1 ? '1' : r.outs[j] === 0 ? '0' : '?').join('');
    const mt = col.includes('?') ? '（有未接線或不確定的訊號）' : mintermText(col);
    return `<div class="expr-row"><div class="lbl">由電路寫出的布林式</div><div class="val">${esc(e.name)} = ${e.expr ? esc(e.expr) : '（式子太長）'}</div>
      <div class="lbl" style="margin-top:4px">最小項表示</div><div class="val">${esc(e.name)} = ${esc(mt)}</div></div>`;
  }).join('') : '<p class="note">加入「輸出」元件後，這裡會寫出布林表示式。</p>';
  pane.innerHTML = `
    <div class="tt-opts">
      <h2 class="pane-title" style="margin:0">真值表</h2>
      ${canExp ? `<label class="small"><input type="checkbox" id="chkExp"${showExp ? ' checked' : ''}> 對照題目要求</label>` : ''}
    </div>
    ${showExp ? `<p class="note">${bad ? `<b style="color:var(--err)">有 ${bad} 列和題目要求不同</b>（紅色列）` : '<b style="color:var(--ok)">每一列都和題目要求相同</b>'}</p>` : ''}
    <p class="note">點一下任一列，輸入開關就會切換成那一列的值。${tt.rows.length > TT_SHOW_ROWS ? `（只顯示前 ${TT_SHOW_ROWS} 列）` : ''}</p>
    <div class="tt-wrap"><table class="tt"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="exprs">${exprHtml}</div>`;
  const chk = $('#chkExp', pane);
  if (chk) chk.addEventListener('change', () => { S.settings.showExpected = chk.checked; saveSettings(); renderTablePane(); });
  $('tbody', pane).addEventListener('click', e => {
    const tr = e.target.closest('tr[data-r]');
    if (!tr) return;
    const bits = bitsOf(+tr.dataset.r, tt.ins.length);
    tt.ins.forEach((c, i) => { c.val = bits[i]; });
    scheduleSave(); requestRender(); renderTablePane();
  });
}

/* ---------- 時序圖 ---------- */
function timingSeq(label, i, n) {
  const T = S.timing, N = T.steps;
  let s = T.seq[label];
  if (!s || s.length !== N) {
    s = [];
    for (let t = 0; t < N; t++) s.push((t % (1 << n)) >> (n - 1 - i) & 1);
    T.seq[label] = s;
  }
  return s;
}
function stopPlay() {
  if (S.timing.timer) { clearInterval(S.timing.timer); S.timing.timer = 0; }
}
function applyStep(t, ins) {
  ins.forEach((c, i) => { c.val = timingSeq(c.label, i, ins.length)[t]; });
  S.timing.cursor = t;
  scheduleSave(); requestRender();
}
function renderTimingPane() {
  const pane = $('#pane-timing'), T = S.timing;
  const { ins, outs } = ioOrder(S.circ, S.asg);
  if (!ins.length) {
    pane.innerHTML = '<h2 class="pane-title">時序圖</h2><p class="empty-note">放入輸入開關後，這裡會畫出輸入與輸出的波形。</p>';
    return;
  }
  const N = T.steps, n = ins.length;
  const seqs = ins.map((c, i) => timingSeq(c.label, i, n));
  const comp = compile(S.circ);
  const outVals = outs.map(() => []);
  for (let t = 0; t < N; t++) {
    const m = new Map();
    ins.forEach((c, i) => m.set(c.id, seqs[i][t]));
    const v = comp.run(m);
    outs.forEach((c, j) => outVals[j].push(v.get(c.id)));
  }
  const P = pal(), W = Math.max(300, Math.min(900, Math.round((pane.clientWidth || 360) - 32))), LW = 50, top = 26, rh = 30, gap = 12;
  const cw = (W - LW - 10) / N;
  const rows = [...ins.map((c, i) => ({ label: c.label, bits: seqs[i], input: true, i })), ...outs.map((c, j) => ({ label: c.label, bits: outVals[j], input: false }))];
  const H = top + rows.length * (rh + gap) + 6;
  const outColor = resolvedTheme() === 'dark' ? '#5AA9E6' : '#2683C6';
  const o = [`<svg class="timing-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="時序圖">`];
  for (let t = 0; t <= N; t++) {
    const x = LW + t * cw;
    o.push(`<line x1="${r1(x)}" y1="${top - 4}" x2="${r1(x)}" y2="${H - 4}" style="stroke:${P.muted}" stroke-opacity="0.3" stroke-dasharray="3 3"/>`);
  }
  if (T.cursor >= 0 && T.cursor < N) o.push(`<rect x="${r1(LW + T.cursor * cw)}" y="${top - 4}" width="${r1(cw)}" height="${H - top}" style="fill:${P.sel}" fill-opacity="0.14"/>`);
  for (let t = 0; t < N; t++) {
    o.push(`<g class="col" data-t="${t}"><rect x="${r1(LW + t * cw)}" y="0" width="${r1(cw)}" height="${top - 4}" fill="transparent"/>` +
      tx(r1(LW + (t + 0.5) * cw), 11, String(t), { fill: T.cursor === t ? P.sel : P.muted, size: 11, weight: 700 }) + '</g>');
  }
  rows.forEach((row, ri) => {
    const y0 = top + ri * (rh + gap), yH = y0 + 4, yL = y0 + rh - 4;
    const col = row.input ? P.text : outColor;
    o.push(tx(LW - 10, y0 + rh / 2, row.label, { fill: col, size: 14, weight: 800, anchor: 'end' }));
    if (!row.input && ri === ins.length) o.push(`<line x1="4" y1="${y0 - gap / 2}" x2="${W - 4}" y2="${y0 - gap / 2}" style="stroke:${P.muted}" stroke-opacity="0.45"/>`);
    let d = '', prev = null;
    for (let t = 0; t < N; t++) {
      const v = row.bits[t], x0 = r1(LW + t * cw), x1 = r1(LW + (t + 1) * cw);
      if (v !== 0 && v !== 1) {
        o.push(`<rect x="${x0}" y="${yH}" width="${r1(cw)}" height="${yL - yH}" style="fill:${P.x}" fill-opacity="0.35"/>`);
        prev = null;
        continue;
      }
      const y = v ? yH : yL;
      d += (prev === null ? `M${x0},${y}` : (prev !== v ? ` V${y}` : '')) + ` H${x1}`;
      prev = v;
    }
    if (d) o.push(`<path d="${d}" style="stroke:${col}" stroke-width="2.4" fill="none" stroke-linejoin="round"/>`);
    if (row.input) {
      for (let t = 0; t < N; t++) o.push(`<rect class="cell" data-i="${row.i}" data-t="${t}" x="${r1(LW + t * cw)}" y="${y0}" width="${r1(cw)}" height="${rh}"><title>點一下切換 ${esc(row.label)} 在時間 ${t} 的值</title></rect>`);
    }
  });
  o.push('</svg>');
  pane.innerHTML = `
    <h2 class="pane-title">時序圖</h2>
    <div class="timing-ctl">
      <label class="small">步數 <select id="tmSteps">${[4, 8, 16, 32].map(v => `<option value="${v}"${v === N ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <button class="btn" id="tmCount" title="輸入依二進位計數順序變化">計數順序</button>
      <button class="btn" id="tmRand">隨機</button>
      <button class="btn" id="tmZero">全部 0</button>
      <button class="btn btn-primary" id="tmPlay">${T.timer ? '■ 停止' : '▶ 播放'}</button>
    </div>
    ${o.join('')}
    <p class="note">點輸入波形可以切換該時間的值；點上方時間數字，畫布上的開關就會切換成那個時間的值。「播放」會依序套用每個時間點，讓你看到電路隨時間變化（理想閘，不考慮延遲）。</p>`;
  $('#tmSteps', pane).addEventListener('change', e => { stopPlay(); T.steps = +e.target.value; T.seq = {}; T.cursor = -1; renderTimingPane(); });
  $('#tmCount', pane).addEventListener('click', () => { T.seq = {}; renderTimingPane(); });
  $('#tmRand', pane).addEventListener('click', () => { ins.forEach(c => { T.seq[c.label] = Array.from({ length: N }, () => Math.random() < 0.5 ? 0 : 1); }); renderTimingPane(); });
  $('#tmZero', pane).addEventListener('click', () => { ins.forEach(c => { T.seq[c.label] = new Array(N).fill(0); }); renderTimingPane(); });
  $('#tmPlay', pane).addEventListener('click', () => {
    if (T.timer) { stopPlay(); renderTimingPane(); return; }
    let t = T.cursor;
    const step = () => {
      const cur = ioOrder(S.circ, S.asg).ins;
      if (!cur.length) { stopPlay(); return; }
      t = (t + 1) % T.steps;
      applyStep(t, cur);
      renderTimingPane();
    };
    T.timer = setInterval(step, 900);
    step();
  });
  const svg = $('svg', pane);
  svg.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (cell) {
      const i = +cell.dataset.i, t = +cell.dataset.t, c = ins[i];
      const s = timingSeq(c.label, i, n);
      s[t] = s[t] ? 0 : 1;
      if (T.cursor === t) applyStep(t, ins);
      renderTimingPane();
      return;
    }
    const colEl = e.target.closest('.col');
    if (colEl) { stopPlay(); applyStep(+colEl.dataset.t, ins); renderTimingPane(); }
  });
}

/* ---------- 繳交狀態 ---------- */
function renderSubmitStatus() {
  const a = S.asg, box = $('#submitStatus');
  let s = a ? `目前題目：<b>${esc(a.title)}</b>` : '目前是<b>自由練習</b>（沒有指定題目，老師會直接看你的電路）';
  if (a && a.selfCheck) {
    const res = checkCircuit(a, S.circ);
    s += `<br>自動檢查：${res.pass ? '<span class="ok">✔ 通過</span>' : `<span class="bad">✘ 未通過</span>（真值表正確 ${res.correct}/${res.total} 列${res.violations.length ? '，有違反限制' : ''}）`}`;
  }
  s += `<br><span class="muted small">閘數 ${countGates(S.circ)}　·　最後修改 ${S.meta.lastEdit ? fmtTime(new Date(S.meta.lastEdit).toISOString()) : '—'}</span>`;
  box.innerHTML = s;
}
