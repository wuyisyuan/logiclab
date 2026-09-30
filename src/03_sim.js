/* ============================================================
 * 03 模擬（三值邏輯 0／1／X）、迴路偵測、真值表
 * ============================================================ */
function not3(v) { return v === X ? X : 1 - v; }
function evalGate(type, vals) {
  switch (type) {
    case 'AND': case 'NAND': {
      let r = 1;
      for (const v of vals) { if (v === 0) { r = 0; break; } if (v !== 1) r = X; }
      return type === 'NAND' ? not3(r) : r;
    }
    case 'OR': case 'NOR': {
      let r = 0;
      for (const v of vals) { if (v === 1) { r = 1; break; } if (v !== 0) r = X; }
      return type === 'NOR' ? not3(r) : r;
    }
    case 'XOR': case 'XNOR': {
      let r = 0;
      for (const v of vals) { if (v !== 0 && v !== 1) { r = X; break; } r ^= v; }
      return type === 'XNOR' ? not3(r) : r;
    }
    case 'NOT': return not3(vals[0]);
    case 'BUF': return vals[0] === 0 || vals[0] === 1 ? vals[0] : X;
  }
  return X;
}

function buildIndex(circ) {
  const byId = new Map();
  for (const c of circ.comps) byId.set(c.id, c);
  const driver = new Map();  // "compId:pin" -> wire
  const fanout = new Map();  // compId -> [wire]
  for (const w of circ.wires) {
    if (!byId.has(w.from) || !byId.has(w.to)) continue;
    driver.set(w.to + ':' + w.pin, w);
    if (!fanout.has(w.from)) fanout.set(w.from, []);
    fanout.get(w.from).push(w);
  }
  return { byId, driver, fanout };
}

/** Tarjan 強連通分量：回傳位於迴路中的元件 id */
function findCycles(circ, idx) {
  let counter = 0;
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], res = new Set();
  const succ = id => (idx.fanout.get(id) || []).map(w => w.to);
  const strong = v => {
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);
    for (const w of succ(v)) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1 || succ(v).includes(v)) comp.forEach(x => res.add(x));
    }
  };
  for (const c of circ.comps) if (!index.has(c.id)) strong(c.id);
  return res;
}

/** 編譯電路：排出計算順序，回傳可重複執行的 run(輸入值) */
function compile(circ) {
  const idx = buildIndex(circ);
  const cyc = findCycles(circ, idx);
  const order = [], seen = new Set();
  const visit = c => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    const n = nIns(c);
    for (let i = 0; i < n; i++) {
      const w = idx.driver.get(c.id + ':' + i);
      if (w && !cyc.has(w.from)) visit(idx.byId.get(w.from));
    }
    order.push(c);
  };
  for (const c of circ.comps) if (!cyc.has(c.id) && c.type !== 'NOTE') visit(c);
  const run = inVals => {
    const val = new Map();
    for (const id of cyc) val.set(id, X);
    for (const c of order) {
      let v;
      if (c.type === 'IN') v = inVals && inVals.has(c.id) ? inVals.get(c.id) : (c.val ? 1 : 0);
      else if (c.type === 'CONST') v = c.val ? 1 : 0;
      else {
        const n = nIns(c), a = new Array(n);
        for (let i = 0; i < n; i++) {
          const w = idx.driver.get(c.id + ':' + i);
          a[i] = w && val.has(w.from) ? val.get(w.from) : X;
        }
        v = c.type === 'OUT' ? (a[0] === 0 || a[0] === 1 ? a[0] : X) : evalGate(c.type, a);
      }
      val.set(c.id, v);
    }
    return val;
  };
  return { idx, cyc, order, run };
}

/** 依題目順序（沒有題目時依名稱）排列輸入與輸出 */
function ioOrder(circ, asg) {
  const rank = (list, names) => {
    const nm = (names || []).map(s => String(s).toLowerCase());
    return list.slice().sort((a, b) => {
      const ia = nm.indexOf(String(a.label || '').toLowerCase()), ib = nm.indexOf(String(b.label || '').toLowerCase());
      const ra = ia < 0 ? 1e6 : ia, rb = ib < 0 ? 1e6 : ib;
      if (ra !== rb) return ra - rb;
      return naturalCompare(a.label || '', b.label || '') || (a.y - b.y) || (a.x - b.x);
    });
  };
  return {
    ins: rank(circ.comps.filter(c => c.type === 'IN'), asg && asg.inputs),
    outs: rank(circ.comps.filter(c => c.type === 'OUT'), asg && asg.outputs.map(o => o.name))
  };
}

function truthTable(circ, asg, comp) {
  comp = comp || compile(circ);
  const { ins, outs } = ioOrder(circ, asg);
  const n = ins.length;
  if (n > MAX_TT_INPUTS) return { ins, outs, rows: [], tooMany: true };
  const rows = [];
  for (let r = 0; r < (1 << n); r++) {
    const bits = bitsOf(r, n), m = new Map();
    ins.forEach((c, i) => m.set(c.id, bits[i]));
    const v = comp.run(m);
    rows.push({ r, ins: bits, outs: outs.map(c => v.get(c.id)) });
  }
  return { ins, outs, rows };
}
