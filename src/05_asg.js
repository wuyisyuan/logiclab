/* ============================================================
 * 05 題目／作業：正規化、指紋、壓縮、預設電路
 * ============================================================ */
const LEVELS = { 1: '入門', 2: '基礎', 3: '進階', 4: '挑戰' };

function posIntOrNull(v, lo = 1, hi = 999) {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return isFinite(n) && n >= lo ? Math.min(n, hi) : null;
}

/** 把題目定義（exercises.js 格式、精簡格式或教師表單）整理成統一格式；有錯誤時丟出 Error */
function normalizeAssignment(def, opts = {}) {
  if (!def || typeof def !== 'object') throw new Error('題目格式不正確');
  let inputs = def.inputs != null ? def.inputs : def.i;
  if (typeof inputs === 'string') inputs = inputs.split(/[\s,，、;；]+/);
  inputs = (Array.isArray(inputs) ? inputs : []).map(cleanLabel).filter(Boolean);
  if (!inputs.length) throw new Error('請至少設定一個輸入變數');
  if (inputs.length > 8) throw new Error('輸入變數最多 8 個');
  const lower = inputs.map(s => s.toLowerCase());
  if (new Set(lower).size !== inputs.length) throw new Error('輸入變數名稱重複');

  const rawOut = def.outputs != null ? def.outputs : def.o;
  let list;
  if (Array.isArray(rawOut)) {
    list = rawOut.map(o => Array.isArray(o)
      ? { name: o[0], tt: o[1], expr: o[2] }
      : { name: o && o.name, tt: o && o.tt, spec: o && (o.spec != null ? o.spec : o.expr), expr: o && o.expr });
  } else {
    list = Object.entries(rawOut || {}).map(([name, spec]) => ({ name, spec, expr: typeof spec === 'string' ? spec : null }));
  }
  if (!list.length) throw new Error('請至少設定一個輸出');
  const outputs = list.map(o => {
    const name = cleanLabel(o.name);
    if (!name) throw new Error('輸出名稱不可以空白');
    if (lower.includes(name.toLowerCase())) throw new Error(`輸出「${name}」和輸入同名`);
    let tt;
    try {
      tt = typeof o.tt === 'string' && o.tt ? specToTT({ tt: o.tt }, inputs) : specToTT(o.spec, inputs);
    } catch (e) { throw new Error(`輸出「${name}」：${e.message}`); }
    const expr = o.expr ? String(o.expr).trim().slice(0, 200) : null;
    return { name, tt, expr: expr || null };
  });
  if (new Set(outputs.map(o => o.name.toLowerCase())).size !== outputs.length) throw new Error('輸出名稱重複');

  const al = def.allowed != null ? def.allowed : def.al;
  let allowed = Array.isArray(al) ? [...new Set(al.map(s => String(s).toUpperCase()).filter(isGate))] : null;
  if (allowed && (!allowed.length || allowed.length === GATE_ORDER.length)) allowed = null;
  const pick = (a, b) => (a !== undefined ? a : b);
  const a = {
    id: String(pick(def.id, '') || '').replace(/[^\w.-]/g, '').slice(0, 40),
    title: String(pick(def.title, def.t) || '未命名作業').slice(0, 80),
    desc: String(pick(def.desc, def.d) || '').slice(0, 4000),
    html: !!opts.builtin,
    builtin: !!opts.builtin,
    level: clamp(Math.round(Number(pick(def.level, def.lv)) || 0), 0, 4),
    group: String(pick(def.group, def.g) || '').slice(0, 40),
    inputs, outputs, allowed,
    maxGates: posIntOrNull(pick(def.maxGates, def.mg)),
    maxFanIn: posIntOrNull(pick(def.maxFanIn, def.mf), 2, 8),
    selfCheck: pick(def.selfCheck, def.sc == null ? true : !!def.sc) !== false,
    showTarget: !!pick(def.showTarget, def.st),
    starter: pick(def.starter, def.sp == null ? true : !!def.sp) !== false,
    hint: String(pick(def.hint, def.hi) || '').slice(0, 400)
  };
  a.hash = asgHash(a);
  if (!a.id) a.id = 'hw-' + a.hash.slice(0, 8);
  return a;
}
function asgHash(a) {
  return hash2(stableStringify({ i: a.inputs, o: a.outputs.map(o => [o.name, o.tt]), al: a.allowed, mg: a.maxGates, mf: a.maxFanIn })).slice(0, 12);
}
/** 精簡格式：full=true 包含說明與提示（作業連結用），否則只保留批改需要的資料（繳交檔用） */
function compactAssignment(a, full) {
  const o = { id: a.id, t: a.title, i: a.inputs, o: a.outputs.map(x => [x.name, x.tt, x.expr || '']), al: a.allowed, mg: a.maxGates, mf: a.maxFanIn, hs: a.hash };
  if (full) Object.assign(o, { d: a.desc, lv: a.level, g: a.group, sc: a.selfCheck ? 1 : 0, st: a.showTarget ? 1 : 0, sp: a.starter ? 1 : 0, hi: a.hint });
  return o;
}
function expandAssignment(o) { return normalizeAssignment(o, { builtin: false }); }

const BUILTIN = new Map();
const BUILTIN_ERRORS = [];
for (const def of (Array.isArray(CFG.exercises) ? CFG.exercises : [])) {
  try {
    if (!def || !def.id) throw new Error('缺少 id');
    const a = normalizeAssignment(def, { builtin: true });
    if (BUILTIN.has(a.id)) throw new Error('id 重複');
    BUILTIN.set(a.id, a);
  } catch (e) {
    BUILTIN_ERRORS.push(`${(def && def.id) || '（未命名）'}：${e.message}`);
    console.warn('[LogicLab] 題庫設定錯誤：', def, e);
  }
}

/** 題目的預設電路：放好固定名稱的輸入與輸出 */
function starterCircuit(a) {
  const circ = newCircuit();
  if (!a || !a.starter) return circ;
  const nIn = a.inputs.length, nOut = a.outputs.length;
  const gap = nIn > 4 ? 60 : 80, y0 = 60;
  a.inputs.forEach((name, i) => circ.comps.push({ id: nextId('c'), type: 'IN', x: 60, y: y0 + i * gap, label: name, val: 0, fixed: true }));
  const spanIn = (nIn - 1) * gap;
  const outGap = nOut > 1 ? Math.max(80, Math.min(140, snap(spanIn / (nOut - 1)))) : 0;
  const oy = snap(y0 + (spanIn - (nOut - 1) * outGap) / 2);
  const ox = nIn >= 3 || nOut >= 2 ? 620 : 520;
  a.outputs.forEach((o, j) => circ.comps.push({ id: nextId('c'), type: 'OUT', x: ox, y: Math.max(20, oy + j * outGap), label: o.name, fixed: true }));
  return circ;
}
/** 載入舊的作答時，確認題目指定的輸入輸出都還在 */
function ensureStarter(circ, a) {
  if (!a || !a.starter) return circ;
  const fresh = starterCircuit(a);
  for (const f of fresh.comps) {
    const ex = circ.comps.find(c => c.type === f.type && String(c.label || '').toLowerCase() === f.label.toLowerCase());
    if (ex) { ex.fixed = true; ex.label = f.label; }
    else circ.comps.push(f);
  }
  return circ;
}
function constraintText(a) {
  const out = [];
  if (a.allowed) out.push('只能用 ' + a.allowed.join('、'));
  if (a.maxGates) out.push(`最多 ${a.maxGates} 個閘`);
  if (a.maxFanIn) out.push(`每個閘最多 ${a.maxFanIn} 個輸入`);
  return out;
}
