/* ============================================================
 * 02 電路資料模型與序列化
 *   comp: { id, type, x, y, label?, val?, n?, text?, fixed? }
 *   wire: { id, from: compId(輸出端), to: compId, pin: 輸入端編號 }
 * ============================================================ */
let SEQ = 1;
function nextId(prefix) { return prefix + (SEQ++).toString(36); }
function bumpSeq(circ) {
  const bump = id => { const k = parseInt(String(id).slice(1), 36); if (!isNaN(k) && k >= SEQ) SEQ = k + 1; };
  circ.comps.forEach(c => bump(c.id));
  circ.wires.forEach(w => bump(w.id));
}
function newCircuit() { return { comps: [], wires: [] }; }
function cloneCircuit(c) { return JSON.parse(JSON.stringify(c)); }

function cleanLabel(s) {
  return String(s == null ? '' : s).replace(/[\s<>&"'`\\/]/g, '').slice(0, 12);
}
function numOr0(v) { const n = Number(v); return isFinite(n) ? clamp(n, -50000, 50000) : 0; }

function makeComp(type, circ) {
  const c = { id: nextId('c'), type, x: 0, y: 0 };
  if (type === 'IN') { c.label = nextLabel(circ, 'IN'); c.val = 0; }
  else if (type === 'OUT') c.label = nextLabel(circ, 'OUT');
  else if (type === 'CONST') c.val = 1;
  else if (type === 'NOTE') c.text = '註解';
  else if (isMulti(type)) c.n = 2;
  return c;
}
function nextLabel(circ, kind) {
  const used = new Set(circ.comps.filter(c => c.type === 'IN' || c.type === 'OUT').map(c => String(c.label || '').toUpperCase()));
  const pool = kind === 'IN' ? 'ABCDEHIJKMNPQRSTUVWXYZ'.split('') : ['F', 'G', 'H', 'Y', 'Z', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
  for (const p of pool) if (!used.has(p)) return p;
  for (let i = 1; i < 999; i++) { const p = (kind === 'IN' ? 'X' : 'F') + i; if (!used.has(p.toUpperCase())) return p; }
  return kind === 'IN' ? 'X' : 'F';
}

/** 移除無效或重複的導線（每個輸入端只保留最後一條） */
function normalizeCircuit(circ) {
  const byId = new Map(circ.comps.map(c => [c.id, c]));
  const keep = new Map();
  for (const w of circ.wires) {
    const a = byId.get(w.from), b = byId.get(w.to);
    if (!a || !b || !hasOut(a)) continue;
    if (!(Number.isInteger(w.pin) && w.pin >= 0 && w.pin < nIns(b))) continue;
    keep.set(w.to + ':' + w.pin, w);
  }
  const set = new Set(keep.values());
  circ.wires = circ.wires.filter(w => set.has(w));
  return circ;
}

/** 精簡格式（存檔、繳交代碼用） */
function toCompact(circ) {
  const index = new Map();
  circ.comps.forEach((c, i) => index.set(c.id, i));
  const c = circ.comps.map(k => {
    switch (k.type) {
      case 'IN': return ['IN', k.x, k.y, k.label || '', k.val ? 1 : 0, k.fixed ? 1 : 0];
      case 'OUT': return ['OUT', k.x, k.y, k.label || '', k.fixed ? 1 : 0];
      case 'CONST': return ['CONST', k.x, k.y, k.val ? 1 : 0];
      case 'NOTE': return ['NOTE', k.x, k.y, k.text || ''];
      default: return isMulti(k.type) ? [k.type, k.x, k.y, nIns(k)] : [k.type, k.x, k.y];
    }
  });
  const w = [];
  for (const x of circ.wires) {
    const a = index.get(x.from), b = index.get(x.to);
    if (a == null || b == null) continue;
    w.push([a, b, x.pin]);
  }
  return { c, w };
}
function fromCompact(o) {
  const circ = newCircuit();
  if (!o || !Array.isArray(o.c)) return circ;
  const ids = [];
  for (const a of o.c) {
    if (!Array.isArray(a) || !ALL_TYPES.includes(String(a[0]))) { ids.push(null); continue; }
    const type = String(a[0]);
    const c = { id: nextId('c'), type, x: numOr0(a[1]), y: numOr0(a[2]) };
    if (type !== 'NOTE') { c.x = snap(c.x); c.y = snap(c.y); }
    if (type === 'IN') { c.label = cleanLabel(a[3]) || 'A'; c.val = a[4] ? 1 : 0; if (a[5]) c.fixed = true; }
    else if (type === 'OUT') { c.label = cleanLabel(a[3]) || 'F'; if (a[4]) c.fixed = true; }
    else if (type === 'CONST') c.val = a[3] ? 1 : 0;
    else if (type === 'NOTE') c.text = String(a[3] == null ? '' : a[3]).replace(/[\r\n]+/g, ' ').slice(0, 80);
    else if (isMulti(type)) c.n = clampN(a[3]);
    circ.comps.push(c);
    ids.push(c.id);
  }
  if (Array.isArray(o.w)) {
    for (const w of o.w) {
      if (!Array.isArray(w)) continue;
      const from = ids[w[0]], to = ids[w[1]];
      if (!from || !to) continue;
      circ.wires.push({ id: nextId('w'), from, to, pin: Number(w[2]) | 0 });
    }
  }
  return normalizeCircuit(circ);
}

/** 版面指紋：元件位置與連線完全相同才會相同（批改時用來提示可能的複製） */
function layoutHash(circ) {
  const comps = circ.comps.filter(c => c.type !== 'NOTE').slice().sort((a, b) =>
    a.x - b.x || a.y - b.y || String(a.type).localeCompare(b.type));
  const idx = new Map(comps.map((c, i) => [c.id, i]));
  const cs = comps.map(c => [c.type, c.x, c.y, nIns(c), String(c.label || '').toUpperCase()].join(','));
  const ws = circ.wires.filter(w => idx.has(w.from) && idx.has(w.to))
    .map(w => idx.get(w.from) + '>' + idx.get(w.to) + ':' + w.pin).sort();
  return hash2(cs.join(';') + '|' + ws.join(';'));
}
function countGates(circ) { return circ.comps.filter(c => isGate(c.type)).length; }
