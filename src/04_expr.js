/* ============================================================
 * 04 布林表示式：由電路寫出式子、解析老師輸入的式子
 *   AST: {k:'var',name} {k:'const',v} {k:'not',a} {k:'and'|'or'|'xor',args} {k:'unk'} {k:'cyc'}
 * ============================================================ */
class ExprError extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }

function circuitAstBuilder(comp) {
  const memo = new Map();
  const node = id => {
    if (comp.cyc.has(id)) return { k: 'cyc' };
    if (memo.has(id)) return memo.get(id);
    const c = comp.idx.byId.get(id);
    const arg = i => { const w = comp.idx.driver.get(id + ':' + i); return w ? node(w.from) : { k: 'unk' }; };
    let r;
    switch (c.type) {
      case 'IN': r = { k: 'var', name: c.label || '?' }; break;
      case 'CONST': r = { k: 'const', v: c.val ? 1 : 0 }; break;
      case 'OUT': case 'BUF': r = arg(0); break;
      case 'NOT': r = { k: 'not', a: arg(0) }; break;
      default: {
        const args = [];
        for (let i = 0; i < nIns(c); i++) args.push(arg(i));
        const k = (c.type === 'AND' || c.type === 'NAND') ? 'and' : (c.type === 'OR' || c.type === 'NOR') ? 'or' : 'xor';
        const base = { k, args };
        r = GATES[c.type].neg ? { k: 'not', a: base } : base;
      }
    }
    memo.set(id, r);
    return r;
  };
  return node;
}

/** AST 轉文字（Roth 課本記法：A' 表示反相、相鄰表示 AND、+ 表示 OR、⊕ 表示 XOR） */
function printAst(root, juxt = true, budget = 3000) {
  const memo = new Map();
  let left = budget;
  const atomic = n => n.k === 'var' || n.k === 'const' || n.k === 'unk' || n.k === 'cyc' || n.k === 'not';
  const p = n => {
    if (memo.has(n)) return memo.get(n);
    let s;
    switch (n.k) {
      case 'var': s = n.name; break;
      case 'const': s = String(n.v); break;
      case 'unk': s = '?'; break;
      case 'cyc': s = '⟲'; break;
      case 'not': s = atomic(n.a) ? p(n.a) + "'" : '(' + p(n.a) + ")'"; break;
      case 'and': s = n.args.map(a => (a.k === 'or' || a.k === 'xor') ? '(' + p(a) + ')' : p(a)).join(juxt ? '' : '·'); break;
      case 'or': s = n.args.map(a => a.k === 'xor' ? '(' + p(a) + ')' : p(a)).join(' + '); break;
      case 'xor': s = n.args.map(a => a.k === 'or' ? '(' + p(a) + ')' : p(a)).join(' ⊕ '); break;
      default: s = '?';
    }
    left -= s.length;
    if (left < 0) throw new ExprError('too long');
    memo.set(n, s);
    return s;
  };
  try { return p(root); } catch (e) { return null; }
}

/** 由電路寫出每個輸出的布林式 */
function circuitExpressions(circ, asg, comp) {
  comp = comp || compile(circ);
  const node = circuitAstBuilder(comp);
  const { ins, outs } = ioOrder(circ, asg);
  const juxt = ins.every(c => String(c.label || '').length <= 1);
  return outs.map(o => ({ name: o.label || '?', expr: printAst(node(o.id), juxt) }));
}

/* ---------- 解析器 ---------- */
function tokenize(src, vars) {
  const toks = [], s = String(src);
  const known = vars && vars.length ? vars.slice().sort((a, b) => b.length - a.length) : null;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('([{（'.includes(ch)) { toks.push({ t: '(', i }); i++; continue; }
    if (')]}）'.includes(ch)) { toks.push({ t: ')', i }); i++; continue; }
    if ("'’′`´‘".includes(ch)) { toks.push({ t: "'", i }); i++; continue; }
    if ('!~¬￢'.includes(ch)) { toks.push({ t: '!', i }); i++; continue; }
    if ('+|∨＋'.includes(ch)) { toks.push({ t: '+', i }); i++; continue; }
    if ('*·&∧⋅•.×＊・'.includes(ch)) { toks.push({ t: '*', i }); i++; continue; }
    if ('^⊕'.includes(ch)) { toks.push({ t: '^', i }); i++; continue; }
    if ('⊙≡'.includes(ch)) { toks.push({ t: '=', i }); i++; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let name = null;
      if (known) {
        for (const v of known) if (s.startsWith(v, i)) { name = v; break; }
        if (!name) for (const v of known) if (s.substr(i, v.length).toLowerCase() === v.toLowerCase()) { name = v; break; }
      }
      if (!name) name = /^(?:[A-Z][a-z0-9_]*|[a-z][0-9_]*|_[A-Za-z0-9_]*)/.exec(s.slice(i))[0];
      toks.push({ t: 'v', name, i });
      i += name.length;
      continue;
    }
    if (ch === '0' || ch === '1') { toks.push({ t: 'c', v: +ch, i }); i++; continue; }
    throw new ExprError(`無法辨識的符號「${ch}」`, i);
  }
  return toks;
}

function parseExpr(src, vars) {
  const toks = tokenize(src, vars);
  let p = 0;
  const peek = () => toks[p];
  const bad = t => new ExprError(t ? `這裡不應該出現「${String(src).slice(t.i, t.i + 1)}」` : '式子不完整', t ? t.i : String(src).length);
  const startsUnary = t => t && (t.t === 'v' || t.t === 'c' || t.t === '(' || t.t === '!');
  const orE = () => {
    const args = [xorE()];
    while (peek() && peek().t === '+') { p++; args.push(xorE()); }
    return args.length > 1 ? { k: 'or', args } : args[0];
  };
  const xorE = () => {
    let a = andE();
    while (peek() && (peek().t === '^' || peek().t === '=')) {
      const op = toks[p++].t, b = andE();
      a = op === '^' ? { k: 'xor', args: a.k === 'xor' ? [...a.args, b] : [a, b] } : { k: 'not', a: { k: 'xor', args: [a, b] } };
    }
    return a;
  };
  const andE = () => {
    const args = [unary()];
    while (peek() && (peek().t === '*' || startsUnary(peek()))) {
      if (peek().t === '*') p++;
      args.push(unary());
    }
    return args.length > 1 ? { k: 'and', args } : args[0];
  };
  const unary = () => {
    if (peek() && peek().t === '!') { p++; return { k: 'not', a: unary() }; }
    let a = atom();
    while (peek() && peek().t === "'") { p++; a = { k: 'not', a }; }
    return a;
  };
  const atom = () => {
    const t = toks[p++];
    if (!t) throw bad(null);
    if (t.t === 'v') return { k: 'var', name: t.name };
    if (t.t === 'c') return { k: 'const', v: t.v };
    if (t.t === '(') {
      const e = orE();
      const r = toks[p++];
      if (!r || r.t !== ')') throw new ExprError('缺少右括號「)」', r ? r.i : String(src).length);
      return e;
    }
    throw bad(t);
  };
  if (!toks.length) throw new ExprError('式子是空的', 0);
  const e = orE();
  if (p < toks.length) throw bad(toks[p]);
  return e;
}
function collectVars(n, out = new Set()) {
  if (n.k === 'var') out.add(n.name);
  else if (n.k === 'not') collectVars(n.a, out);
  else if (n.args) n.args.forEach(a => collectVars(a, out));
  return out;
}
function evalAst(n, env) {
  switch (n.k) {
    case 'var': return env[n.name];
    case 'const': return n.v;
    case 'not': return 1 - evalAst(n.a, env);
    case 'and': { let r = 1; for (const a of n.args) r &= evalAst(a, env); return r; }
    case 'or': { let r = 0; for (const a of n.args) r |= evalAst(a, env); return r; }
    case 'xor': { let r = 0; for (const a of n.args) r ^= evalAst(a, env); return r; }
  }
  return 0;
}

function parseIndexList(s, rows, what) {
  const t = String(s || '').trim();
  if (!t) return [];
  return t.split(/[\s,，、]+/).filter(Boolean).map(x => {
    if (!/^\d+$/.test(x)) throw new ExprError(`${what}「${x}」不是整數`);
    const v = parseInt(x, 10);
    if (v >= rows) throw new ExprError(`${what} ${v} 超出範圍（輸入 ${Math.log2(rows)} 個時只有 0～${rows - 1}）`);
    return v;
  });
}
function ttFromLists(ones, dcs, rows, onesAreZeros = false) {
  const a = new Array(rows).fill(onesAreZeros ? '1' : '0');
  for (const v of ones) a[v] = onesAreZeros ? '0' : '1';
  for (const v of dcs) {
    if (ones.includes(v)) throw new ExprError(`第 ${v} 項同時出現在 ${onesAreZeros ? 'M' : 'm'} 與 d 中`);
    a[v] = 'x';
  }
  return a.join('');
}

/** 目標規格 → 真值表字串（第 r 個字元 = 第 r 列，字元為 0／1／x） */
function specToTT(spec, inputs) {
  const n = inputs.length, rows = 1 << n;
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    if (typeof spec.tt === 'string') {
      const t = spec.tt.toLowerCase().replace(/[^01x-]/g, '').replace(/-/g, 'x');
      if (t.length !== rows) throw new ExprError(`真值表應有 ${rows} 列，目前是 ${t.length} 列`);
      return t;
    }
    if (Array.isArray(spec.m)) return ttFromLists(parseIndexList(spec.m.join(','), rows, '最小項'), parseIndexList((spec.d || []).join(','), rows, '無關項'), rows);
    if (Array.isArray(spec.M)) return ttFromLists(parseIndexList(spec.M.join(','), rows, '最大項'), parseIndexList((spec.d || []).join(','), rows, '無關項'), rows, true);
  }
  const s = String(spec == null ? '' : spec).trim();
  if (!s) throw new ExprError('輸出的式子是空的');
  let m = /^(?:Σ|∑|sum)?\s*m\s*[(（]([\d\s,，、]*)[)）]\s*(?:\+\s*d\s*[(（]([\d\s,，、]*)[)）])?\s*$/.exec(s);
  if (m) return ttFromLists(parseIndexList(m[1], rows, '最小項'), parseIndexList(m[2], rows, '無關項'), rows);
  m = /^(?:Π|∏|prod)?\s*M\s*[(（]([\d\s,，、]*)[)）]\s*(?:[·*]?\s*d\s*[(（]([\d\s,，、]*)[)）])?\s*$/.exec(s);
  if (m) return ttFromLists(parseIndexList(m[1], rows, '最大項'), parseIndexList(m[2], rows, '無關項'), rows, true);
  const ast = parseExpr(s, inputs);
  for (const v of collectVars(ast)) {
    if (!inputs.includes(v)) throw new ExprError(`式子中的「${v}」不在輸入變數（${inputs.join('、')}）中`);
  }
  let t = '';
  for (let r = 0; r < rows; r++) {
    const env = {};
    bitsOf(r, n).forEach((b, i) => { env[inputs[i]] = b; });
    t += evalAst(ast, env);
  }
  return t;
}
function mintermText(tt) {
  if (/[^01x]/.test(tt)) return null;
  const ones = [], dcs = [];
  for (let i = 0; i < tt.length; i++) { if (tt[i] === '1') ones.push(i); else if (tt[i] === 'x') dcs.push(i); }
  return 'Σm(' + ones.join(', ') + ')' + (dcs.length ? ' + d(' + dcs.join(', ') + ')' : '');
}
