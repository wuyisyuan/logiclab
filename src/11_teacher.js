/* ============================================================
 * 11 教師專區：出題（作業連結）與批改
 * ============================================================ */
const G = { entries: [], rows: [] };

function openTeacher(tab) {
  const dlg = $('#dlgTeacher');
  if (!$('#tAllowed').children.length) {
    $('#tAllowed').append(...GATE_ORDER.map(t => el('label', {}, el('input', { type: 'checkbox', value: t, checked: true }), t)));
  }
  setTeacherTab(tab || 'make');
  if (!dlg.open) dlg.showModal();
  if (BUILTIN_ERRORS.length && !$('#tBuiltinErr')) {
    $('#tPreview').before(el('div', { id: 'tBuiltinErr', class: 'result fail small', style: 'margin-bottom:10px' },
      el('b', {}, 'exercises.js 題庫有設定錯誤：'), el('ul', {}, BUILTIN_ERRORS.map(s => el('li', {}, s)))));
  }
}
function setTeacherTab(name) {
  for (const b of $$('#dlgTeacher [data-ttab]')) b.setAttribute('aria-selected', b.dataset.ttab === name ? 'true' : 'false');
  for (const p of $$('#dlgTeacher [data-tpane]')) p.hidden = p.dataset.tpane !== name;
}

/* ---------- 出題 ---------- */
function readTeacherForm() {
  const lines = $('#tOutputs').value.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const outputs = lines.map((line, i) => {
    const m = /^([^=:：]+?)\s*[=:：]\s*(.+)$/.exec(line);
    if (!m) throw new Error(`輸出第 ${i + 1} 行的格式應為「F = 式子」`);
    return { name: m[1].trim(), spec: m[2].trim(), expr: m[2].trim() };
  });
  const allowed = $$('#tAllowed input:checked').map(i => i.value);
  if (!allowed.length) throw new Error('至少要允許一種邏輯閘');
  return normalizeAssignment({
    title: $('#tTitle').value.trim() || '未命名作業',
    desc: $('#tDesc').value.trim(),
    inputs: $('#tInputs').value,
    outputs,
    allowed: allowed.length === GATE_ORDER.length ? null : allowed,
    maxGates: $('#tMaxGates').value,
    maxFanIn: $('#tMaxFanIn').value,
    selfCheck: $('#tSelfCheck').checked,
    showTarget: $('#tShowTarget').checked,
    starter: $('#tStarter').checked,
    hint: $('#tHint').value.trim()
  });
}
function previewAssignment() {
  const box = $('#tPreview');
  try {
    const a = readTeacherForm();
    box.classList.remove('muted');
    box.innerHTML = `<div><b>${esc(a.title)}</b>　<span class="small muted">輸入 ${a.inputs.length} 個、輸出 ${a.outputs.length} 個</span></div>
      <div class="small" style="margin:6px 0">${a.outputs.map(o => `${esc(o.name)} = ${esc(mintermText(o.tt))}`).join('<br>')}</div>
      ${constraintText(a).length ? `<div class="chips">${constraintText(a).map(t => `<span class="chip limit">${esc(t)}</span>`).join('')}</div>` : ''}
      ${targetTableHTML(a)}`;
    return a;
  } catch (e) {
    box.classList.remove('muted');
    box.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    return null;
  }
}
function fillFromCircuit() {
  const { ins, outs } = ioOrder(S.circ, null);
  if (!ins.length || !outs.length) { toast('畫布上需要有輸入與輸出元件', 'warn'); return; }
  if (ins.length > 8) { toast('輸入最多 8 個', 'warn'); return; }
  const comp = compile(S.circ);
  if (comp.cyc.size) { toast('電路有迴路，無法當作答案', 'warn'); return; }
  const tt = truthTable(S.circ, null, comp);
  const exprs = circuitExpressions(S.circ, null, comp);
  let unknown = false;
  $('#tInputs').value = ins.map(c => c.label).join(', ');
  $('#tOutputs').value = outs.map((c, j) => {
    const col = tt.rows.map(r => r.outs[j] === 1 ? '1' : r.outs[j] === 0 ? '0' : 'x').join('');
    if (col.includes('x')) unknown = true;
    const e = exprs[j].expr;
    const useExpr = e && e.length <= 60 && !/[?⟲]/.test(e);
    return `${c.label} = ${useExpr ? e : mintermText(col)}`;
  }).join('\n');
  if (!$('#tTitle').value.trim() && S.asg) $('#tTitle').value = S.asg.title;
  if (unknown) toast('電路有未接線的輸入，部分輸出不確定（已設成無關項），請確認', 'warn', 5000);
  previewAssignment();
}
function siteBase() { return location.href.replace(/#.*$/, ''); }
async function makeAssignmentLink() {
  const a = previewAssignment();
  if (!a) return;
  const code = await packCode(ASG_PREFIX, compactAssignment(a, true));
  const link = siteBase() + '#hw=' + code;
  $('#tResult').hidden = false;
  $('#tLink').value = link;
  $('#tLink').dataset.code = code;
  $('#tLinkNote').textContent = location.protocol === 'file:'
    ? '提醒：目前是從電腦上的檔案開啟，這個連結只能在這台電腦使用。部署到 GitHub Pages 後，請在網站上重新產生連結給學生。'
    : `連結長度 ${link.length} 字元。題目內容都存在連結裡，不需要伺服器。`;
  rememberCustom(a, code);
  buildTaskSelect();
}
function exercisesSnippet(a) {
  const q = s => JSON.stringify(s);
  const outs = a.outputs.map(o => `${/^[A-Za-z_][A-Za-z0-9_]*$/.test(o.name) ? o.name : q(o.name)}: ${q(o.expr || mintermText(o.tt).replace('Σ', ''))}`).join(', ');
  const lines = [
    '{',
    `  id: ${q(a.id)}, group: '老師自訂', level: 2,`,
    `  title: ${q(a.title)},`,
    `  desc: ${q(a.desc ? '<p>' + escText(a.desc) + '</p>' : '')},`,
    `  inputs: ${JSON.stringify(a.inputs)},`,
    `  outputs: { ${outs} },`
  ];
  const extra = [];
  if (a.allowed) extra.push(`allowed: ${JSON.stringify(a.allowed)}`);
  if (a.maxGates) extra.push(`maxGates: ${a.maxGates}`);
  if (a.maxFanIn) extra.push(`maxFanIn: ${a.maxFanIn}`);
  if (a.showTarget) extra.push('showTarget: true');
  if (!a.selfCheck) extra.push('selfCheck: false');
  if (a.hint) extra.push(`hint: ${q(a.hint)}`);
  if (extra.length) lines.push('  ' + extra.join(', ') + ',');
  lines.push('},');
  return lines.join('\n');
}

/* ---------- 批改 ---------- */
function findCodes(text) {
  const re = new RegExp(SUB_PREFIX + '[jz][A-Za-z0-9_-]{12,}', 'g');
  return [...new Set(String(text || '').match(re) || [])];
}
async function readGradeFiles(files) {
  const out = [];
  for (const f of files) {
    let text = '';
    try { text = await f.text(); } catch (e) { out.push({ source: f.name, error: '無法讀取檔案' }); continue; }
    const trimmed = text.trim();
    if (/\.json$/i.test(f.name) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const j = JSON.parse(trimmed);
        const arr = Array.isArray(j) ? j : [j];
        arr.forEach((s, i) => out.push({ source: f.name + (arr.length > 1 ? `（第 ${i + 1} 筆）` : ''), sub: s }));
      } catch (e) {
        const codes = findCodes(text);
        if (codes.length) codes.forEach(code => out.push({ source: f.name, code }));
        else out.push({ source: f.name, error: 'JSON 格式錯誤' });
      }
    } else {
      const codes = findCodes(text);
      if (!codes.length) out.push({ source: f.name, error: '檔案中找不到繳交代碼' });
      codes.forEach(code => out.push({ source: f.name, code }));
    }
  }
  return out;
}
async function parseRefAssignment() {
  const t = $('#gRef').value.trim();
  if (!t) return null;
  const m = /hw=([A-Za-z0-9_-]+)/.exec(t);
  return expandAssignment(await unpackCode(m ? m[1] : t, ASG_PREFIX));
}
function gradeOne(sub, ref) {
  if (!sub || typeof sub !== 'object' || sub.app !== 'logiclab' || sub.kind !== 'submission' || !sub.circuit) return { error: '不是 LogicLab 作業檔' };
  const flags = [];
  if (sub.sig !== subSig(sub)) flags.push('檔案內容被修改過');
  const circ = fromCompact(sub.circuit);
  let emb = null;
  if (sub.assignment) { try { emb = expandAssignment(sub.assignment); } catch (e) { flags.push('題目資料損毀'); } }
  let asg = null, basis = '';
  if (ref) {
    asg = ref; basis = '指定作業';
    if (!emb) flags.push('學生繳交的是自由練習');
    else if (emb.hash !== ref.hash) flags.push('學生作答的題目與指定作業不同');
  } else if (emb && BUILTIN.has(emb.id)) {
    asg = BUILTIN.get(emb.id); basis = '內建題目';
    if (emb.hash !== asg.hash) flags.push('題目版本與目前的內建題目不同');
  } else if (emb) { asg = emb; basis = '檔案內題目'; }
  const res = asg ? checkCircuit(asg, circ) : null;
  const st = sub.student || {};
  return {
    sid: String(st.id || '').slice(0, 30), name: String(st.name || '').slice(0, 30),
    asg, basis, res, circ, flags, meta: sub.meta || {}, gates: countGates(circ), lh: layoutHash(circ)
  };
}
async function runGrading() {
  let ref = null;
  try { ref = await parseRefAssignment(); } catch (e) { toast('批改依據的作業連結無法解析：' + e.message, 'err', 5000); return; }
  const entries = [...G.entries, ...findCodes($('#gPaste').value).map(code => ({ source: '貼上的代碼', code }))];
  if (!entries.length) { toast('請先拖入作業檔或貼上繳交代碼', 'warn'); return; }
  const rows = [];
  for (const e of entries) {
    let sub = e.sub, err = e.error;
    if (!sub && e.code) { try { sub = await unpackCode(e.code, SUB_PREFIX); } catch (x) { err = x.message; } }
    if (err || !sub) { rows.push({ source: e.source, error: err || '無法解析' }); continue; }
    const g = gradeOne(sub, ref);
    rows.push(Object.assign({ source: e.source }, g));
  }
  // 重複繳交：同一學號、同一題只以最新的為準
  const latest = new Map();
  for (const r of rows) {
    if (r.error) continue;
    const k = r.sid + '|' + (r.asg ? r.asg.id : 'free'), t = Date.parse(r.meta.submittedAt) || 0;
    if (!latest.has(k) || t >= latest.get(k).t) latest.set(k, { t, r });
  }
  for (const r of rows) {
    if (r.error) continue;
    const k = r.sid + '|' + (r.asg ? r.asg.id : 'free');
    r.old = latest.get(k).r !== r;
  }
  // 版面完全相同（不同學號、至少 3 個閘）
  const groups = new Map();
  for (const r of rows) { if (r.error || r.old || r.gates < 3) continue; const k = r.lh; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  let gi = 0;
  for (const list of groups.values()) {
    if (new Set(list.map(r => r.sid)).size < 2) continue;
    const tag = String.fromCharCode(65 + (gi++ % 26));
    list.forEach(r => { r.same = tag; r.flags.push(`版面與其他同學完全相同（第 ${tag} 組）`); });
  }
  rows.sort((a, b) => (a.error ? 1 : 0) - (b.error ? 1 : 0) || naturalCompare(a.sid || '', b.sid || '') || ((Date.parse(a.meta && a.meta.submittedAt) || 0) - (Date.parse(b.meta && b.meta.submittedAt) || 0)));
  G.rows = rows;
  renderGradeTable();
}
function renderGradeTable() {
  const rows = G.rows, box = $('#gTable');
  $('#gCsv').disabled = !rows.length;
  if (!rows.length) { box.innerHTML = ''; $('#gSummary').textContent = ''; return; }
  const valid = rows.filter(r => !r.error && !r.old);
  const pass = valid.filter(r => r.res && r.res.pass).length;
  $('#gSummary').textContent = `共 ${rows.length} 筆，有效 ${valid.length} 筆，通過 ${pass} 筆`;
  const trs = rows.map((r, i) => {
    if (r.error) return `<tr><td colspan="8"><span class="badge bad">無法批改</span> ${esc(r.source)}：${esc(r.error)}</td><td></td></tr>`;
    const badge = !r.res ? '<span class="badge na">未指定題目</span>' : r.res.pass ? '<span class="badge ok">通過</span>' : '<span class="badge bad">未通過</span>';
    const notes = [...(r.res ? [...r.res.errors, ...r.res.violations] : []), ...r.flags];
    if (r.old) notes.unshift('（較舊的繳交，以最新一筆為準）');
    return `<tr class="${r.old ? 'old' : ''}"><td>${esc(r.sid)}</td><td>${esc(r.name)}</td><td>${esc(r.asg ? r.asg.title : '自由練習')}</td><td>${badge}</td>
      <td>${r.res ? `${r.res.correct}/${r.res.total}` : '—'}</td><td>${r.gates}</td><td class="small">${esc(fmtTime(r.meta.submittedAt))}</td>
      <td class="small">${notes.map(s => `<div class="${/相同|修改|不同|自由/.test(s) ? 'flag' : ''}">${esc(s)}</div>`).join('')}</td>
      <td><button class="btn" data-pv="${i}">檢視</button></td></tr>`;
  }).join('');
  box.innerHTML = `<table class="grades"><thead><tr><th>學號</th><th>姓名</th><th>題目</th><th>結果</th><th>正確列</th><th>閘數</th><th>繳交時間</th><th>備註</th><th></th></tr></thead><tbody>${trs}</tbody></table>`;
}
function gradeCSV() {
  const head = ['學號', '姓名', '題目代號', '題目名稱', '結果', '正確列數', '總列數', '正確率(%)', '閘數', '違反限制', '錯誤與提醒', '繳交時間', '作答時間(分)', '編輯次數', '最新一筆', '版面相同組別', '批改依據', '來源'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of G.rows) {
    if (r.error) { lines.push([...new Array(10).fill(''), '無法批改：' + r.error, '', '', '', '', '', '', r.source].map(csvCell).join(',')); continue; }
    const res = r.res;
    lines.push([
      r.sid, r.name, r.asg ? r.asg.id : '', r.asg ? r.asg.title : '自由練習',
      res ? (res.pass ? '通過' : '未通過') : '未指定題目', res ? res.correct : '', res ? res.total : '',
      res ? Math.round(100 * res.correct / res.total) : '', r.gates, res ? res.violations.join('；') : '',
      [...(res ? res.errors : []), ...r.flags].join('；'), fmtTime(r.meta.submittedAt),
      r.meta.activeSec != null ? Math.round(r.meta.activeSec / 6) / 10 : '', r.meta.edits != null ? r.meta.edits : '',
      r.old ? '否' : '是', r.same || '', r.basis, r.source
    ].map(csvCell).join(','));
  }
  download(`logiclab_grades_${stampForFile()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}
function showPreview(r) {
  const title = r.asg ? r.asg.title : '自由練習';
  const { svg } = exportSVGString(r.circ, { title, subtitle: `${r.sid} ${r.name}　·　${fmtTime(r.meta.submittedAt)}`, asg: r.asg, tt: true, iec: S.settings.symbol === 'iec', wire: S.settings.wire });
  let detail = '';
  if (r.res) {
    const res = r.res, list = arr => arr.length ? `<ul>${arr.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';
    const wrong = res.rows.filter(x => !x.ok);
    detail = `<div class="result ${res.pass ? 'pass' : 'fail'}"><div class="result-head">${res.pass ? '✔ 通過' : '✘ 未通過'}</div>
      <div>真值表正確 ${res.correct}/${res.total} 列，閘數 ${res.gateCount}</div>
      ${list([...res.errors, ...res.violations])}
      ${wrong.length ? `<ul class="rowlist">${wrong.slice(0, 8).map(x => { const d = describeRow(r.asg, x); return `<li>${esc(d.ins)}：應為 ${esc(d.exp)}，實際 ${esc(d.got)}</li>`; }).join('')}</ul>` : ''}
      ${list(res.warnings)}</div>`;
  }
  const flags = r.flags.length ? `<div class="result info" style="margin-top:10px">${r.flags.map(f => `<div class="flag">${esc(f)}</div>`).join('')}</div>` : '';
  const meta = `<p class="small muted">批改依據：${esc(r.basis || '—')}｜作答時間約 ${r.meta.activeSec != null ? Math.round(r.meta.activeSec / 60) : '—'} 分鐘｜編輯 ${r.meta.edits != null ? r.meta.edits : '—'} 次｜來源：${esc(r.source)}</p>`;
  $('#pvTitle').textContent = `${r.sid} ${r.name}`;
  $('#pvBody').innerHTML = `<div class="pv-grid"><div class="pv-svg">${svg}</div><div>${detail}${flags}${meta}
    <div class="row-btns"><button class="btn" id="pvOpen">在編輯器中開啟（投影討論）</button></div></div></div>`;
  $('#pvOpen').addEventListener('click', () => {
    $('#dlgPreview').close();
    $('#dlgTeacher').close();
    openReview(r);
  });
  $('#dlgPreview').showModal();
}
function openReview(r) {
  if (S.key) saveWork();
  stopPlay();
  S.asg = r.asg || null;
  S.key = 'review';
  S.circ = cloneCircuit(r.circ);
  S.meta = freshMeta();
  S.undo = []; S.redo = []; S.sel.clear(); S.selWire = null; S.pending = null; S.lastCheck = null; S.checkVer = -1;
  S.geoVer++; S.editVer++;
  S.reviewLabel = `檢視：${r.sid} ${r.name}`;
  history.replaceState(null, '', siteBase());
  buildTaskSelect();
  updatePaletteState(); updateSelTools(); updateUndoButtons();
  requestRender(); renderPanels();
  requestAnimationFrame(fitView);
  toast(`正在檢視 ${r.sid} ${r.name} 的作業（不會影響你自己的作答）`, 'info', 4000);
}
function bindTeacher() {
  for (const b of $$('#dlgTeacher [data-ttab]')) b.addEventListener('click', () => setTeacherTab(b.dataset.ttab));
  $('#tPreviewBtn').addEventListener('click', previewAssignment);
  $('#tFromCircuit').addEventListener('click', fillFromCircuit);
  $('#tMake').addEventListener('click', makeAssignmentLink);
  $('#tCopyLink').addEventListener('click', async () => { if (await copyText($('#tLink').value)) toast('已複製作業連結', 'ok'); else { $('#tLink').select(); toast('請手動複製連結', 'warn'); } });
  $('#tOpenLink').addEventListener('click', () => { const code = $('#tLink').dataset.code; if (!code) return; $('#dlgTeacher').close(); navigateHash('hw=' + code); });
  $('#tCopyJs').addEventListener('click', async () => {
    const a = previewAssignment();
    if (!a) return;
    if (await copyText(exercisesSnippet(a))) toast('已複製，可貼到 exercises.js 的 exercises 陣列中', 'ok', 4000);
    else toast('無法複製', 'err');
  });
  const drop = $('#gDrop');
  const addFiles = async files => {
    const got = await readGradeFiles([...files]);
    G.entries.push(...got);
    toast(`已讀入 ${got.length} 筆`, 'ok');
    runGrading();
  };
  $('#gPick').addEventListener('click', () => $('#gFiles').click());
  $('#gFiles').addEventListener('change', e => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ''; });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  $('#gRun').addEventListener('click', runGrading);
  $('#gCsv').addEventListener('click', gradeCSV);
  $('#gClear').addEventListener('click', () => { G.entries = []; G.rows = []; $('#gPaste').value = ''; renderGradeTable(); });
  $('#gTable').addEventListener('click', e => { const b = e.target.closest('[data-pv]'); if (b) showPreview(G.rows[+b.dataset.pv]); });
}
