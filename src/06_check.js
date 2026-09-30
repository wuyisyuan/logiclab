/* ============================================================
 * 06 檢查答案（學生自我檢查與老師批改共用）
 * ============================================================ */
function checkCircuit(a, circ) {
  const errors = [], violations = [], warnings = [];
  const norm = s => String(s == null ? '' : s).trim().toLowerCase();
  const inMap = new Map(), outMap = new Map();
  for (const c of circ.comps.filter(c => c.type === 'IN')) {
    const name = a.inputs.find(n => norm(n) === norm(c.label));
    if (!name) { errors.push(`輸入「${c.label || '（未命名）'}」不是本題的輸入（本題輸入：${a.inputs.join('、')}）`); continue; }
    if (inMap.has(name)) { errors.push(`輸入「${name}」重複出現`); continue; }
    inMap.set(name, c);
  }
  for (const n of a.inputs) if (!inMap.has(n)) errors.push(`缺少輸入「${n}」`);
  for (const c of circ.comps.filter(c => c.type === 'OUT')) {
    const o = a.outputs.find(o => norm(o.name) === norm(c.label));
    if (!o) { warnings.push(`輸出「${c.label || '（未命名）'}」不是本題要求的輸出，不列入評分`); continue; }
    if (outMap.has(o.name)) { errors.push(`輸出「${o.name}」重複出現`); continue; }
    outMap.set(o.name, c);
  }
  for (const o of a.outputs) if (!outMap.has(o.name)) errors.push(`缺少輸出「${o.name}」`);

  const gates = circ.comps.filter(c => isGate(c.type));
  const gateCount = gates.length;
  const badGates = new Set();
  if (a.allowed) {
    const bad = gates.filter(g => !a.allowed.includes(g.type));
    if (bad.length) {
      bad.forEach(g => badGates.add(g.id));
      violations.push(`使用了本題不允許的閘：${[...new Set(bad.map(g => g.type))].join('、')}（只能用 ${a.allowed.join('、')}）`);
    }
  }
  if (a.maxGates && gateCount > a.maxGates) violations.push(`用了 ${gateCount} 個閘，超過上限 ${a.maxGates} 個`);
  if (a.maxFanIn) {
    const big = gates.filter(g => nIns(g) > a.maxFanIn);
    if (big.length) { big.forEach(g => badGates.add(g.id)); violations.push(`有 ${big.length} 個閘的輸入數超過 ${a.maxFanIn}`); }
  }

  const comp = compile(circ);
  if (comp.cyc.size) errors.push('電路中有迴路（輸出又繞回自己的輸入），組合邏輯電路不應該有迴路');
  let floating = 0;
  for (const c of circ.comps) for (let i = 0; i < nIns(c); i++) if (!comp.idx.driver.has(c.id + ':' + i)) floating++;

  // 沒有接到任何輸出的閘
  const used = new Set();
  const mark = id => {
    if (used.has(id)) return;
    used.add(id);
    const c = comp.idx.byId.get(id);
    for (let i = 0; i < nIns(c); i++) { const w = comp.idx.driver.get(id + ':' + i); if (w) mark(w.from); }
  };
  for (const c of outMap.values()) mark(c.id);
  const unused = gates.filter(g => !used.has(g.id)).length;
  if (unused) warnings.push(`有 ${unused} 個閘沒有接到輸出（仍會計入閘數），可以刪掉`);

  const n = a.inputs.length, total = 1 << n, rows = [];
  let correct = 0;
  for (let r = 0; r < total; r++) {
    const bits = bitsOf(r, n), m = new Map();
    a.inputs.forEach((name, i) => { const c = inMap.get(name); if (c) m.set(c.id, bits[i]); });
    const v = comp.run(m);
    const got = a.outputs.map(o => { const c = outMap.get(o.name); return c ? v.get(c.id) : null; });
    const exp = a.outputs.map(o => o.tt[r]);
    const ok = exp.every((e, j) => e === 'x' || ((got[j] === 0 || got[j] === 1) && String(got[j]) === e));
    if (ok) correct++;
    rows.push({ r, bits, got, exp, ok });
  }
  if (floating && correct < total) warnings.unshift(`還有 ${floating} 個輸入端沒有接線（橘色空心圓），沒接線的訊號是「不確定」`);
  const pass = !errors.length && !violations.length && correct === total;
  return { pass, errors, violations, warnings, rows, correct, total, gateCount, floating, badGates, comp };
}

function describeRow(a, row) {
  const ins = a.inputs.map((n, i) => `${n}=${row.bits[i]}`).join(', ');
  const exp = a.outputs.map((o, j) => row.exp[j] === 'x' ? null : `${o.name}=${row.exp[j]}`).filter(Boolean).join(', ');
  const got = a.outputs.map((o, j) => `${o.name}=${row.got[j] === 0 || row.got[j] === 1 ? row.got[j] : (row.got[j] === null ? '—' : '?')}`).join(', ');
  return { ins, exp, got };
}
