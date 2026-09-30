/* ============================================================
 * 01 邏輯閘定義、幾何形狀與 SVG 繪製
 * ============================================================ */
const GATES = {
  AND:  { zh: '及閘',       max: 4, iec: '&',  neg: false, desc: '所有輸入都是 1，輸出才是 1', expr: 'F = AB' },
  OR:   { zh: '或閘',       max: 4, iec: '≥1', neg: false, desc: '任一輸入是 1，輸出就是 1', expr: 'F = A + B' },
  NAND: { zh: '反及閘',     max: 4, iec: '&',  neg: true,  desc: 'AND 再反相：所有輸入都是 1 時輸出 0', expr: "F = (AB)'" },
  NOR:  { zh: '反或閘',     max: 4, iec: '≥1', neg: true,  desc: 'OR 再反相：所有輸入都是 0 時輸出 1', expr: "F = (A + B)'" },
  XOR:  { zh: '互斥或閘',   max: 4, iec: '=1', neg: false, desc: '輸入中 1 的個數為奇數時輸出 1', expr: 'F = A ⊕ B' },
  XNOR: { zh: '互斥反或閘', max: 4, iec: '=1', neg: true,  desc: '輸入中 1 的個數為偶數時輸出 1', expr: "F = (A ⊕ B)'" },
  NOT:  { zh: '反閘',       max: 1, iec: '1',  neg: true,  desc: '輸出與輸入相反', expr: "F = A'" },
  BUF:  { zh: '緩衝閘',     max: 1, iec: '1',  neg: false, desc: '輸出等於輸入（用來增強驅動能力）', expr: 'F = A' }
};
const GATE_ORDER = ['NOT', 'BUF', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];
const SPECIAL = {
  IN:    { name: '輸入', zh: '開關', desc: '輸入開關：點一下切換 0／1' },
  OUT:   { name: '輸出', zh: '指示燈', desc: '輸出指示燈：顯示接到它的訊號' },
  CONST: { name: '常數', zh: '固定 0／1', desc: '固定輸出 0 或 1（點一下切換）' },
  NOTE:  { name: '註解', zh: '文字', desc: '在畫布上加一段文字說明' }
};
const ALL_TYPES = ['IN', 'OUT', 'CONST', 'NOTE', ...GATE_ORDER];

const PAL_LIGHT = {
  stroke: '#1F3A4D', fill: '#FFFFFF', text: '#1F3A4D', muted: '#6B7F8E', hi: '#F76707', lo: '#5B7385', x: '#A3B3C0',
  sel: '#1CADE4', err: '#C92A2A', warn: '#E8590C', ledOff: '#E9EEF2', fixed: '#2683C6', noteBg: '#FFF9DB', noteLine: '#E6CF8B', bg: '#FFFFFF'
};
const PAL_DARK = {
  stroke: '#C9D9E6', fill: '#15232D', text: '#E3EDF4', muted: '#8BA0AF', hi: '#FF922B', lo: '#7D95A7', x: '#4E6270',
  sel: '#3BC9F5', err: '#FF6B6B', warn: '#FFA94D', ledOff: '#243642', fixed: '#74C0FC', noteBg: '#3A3217', noteLine: '#7A6A2E', bg: '#0F1A22'
};

function isGate(t) { return Object.prototype.hasOwnProperty.call(GATES, t); }
function isMulti(t) { return isGate(t) && GATES[t].max > 1; }
function clampN(n) { n = Math.round(Number(n) || 2); return n < 2 ? 2 : n > 8 ? 8 : n; }
function nIns(c) {
  if (c.type === 'OUT') return 1;
  if (!isGate(c.type)) return 0;
  return GATES[c.type].max === 1 ? 1 : clampN(c.n);
}
function hasOut(c) { return c.type !== 'OUT' && c.type !== 'NOTE'; }
function typeName(t) { return isGate(t) ? t : (SPECIAL[t] ? SPECIAL[t].name : t); }
function typeZh(t) { return isGate(t) ? GATES[t].zh : (SPECIAL[t] ? SPECIAL[t].zh : ''); }

function textW(s, size = 17) {
  let w = 0;
  for (const ch of String(s == null ? '' : s)) w += /[\u0000-ÿ]/.test(ch) ? size * 0.6 : size;
  return w;
}
function noteWidth(text) { return Math.max(40, Math.ceil((textW(text || ' ', 14) + 20) / 10) * 10); }

const GEOM = new Map();
function geom(c) {
  let key = c.type;
  if (isMulti(c.type)) key += nIns(c);
  else if (c.type === 'NOTE') key += '|' + (c.text || '');
  let g = GEOM.get(key);
  if (g) return g;
  switch (c.type) {
    case 'IN': g = { w: 60, h: 40, ins: [], out: [60, 20], body: [16, 6, 48, 34] }; break;
    case 'OUT': g = { w: 60, h: 40, ins: [[0, 20]], out: null, body: [16, 6, 44, 34] }; break;
    case 'CONST': g = { w: 40, h: 40, ins: [], out: [40, 20], body: [4, 8, 34, 32] }; break;
    case 'NOTE': { const w = noteWidth(c.text); g = { w, h: 30, ins: [], out: null, body: [0, 0, w, 30] }; break; }
    case 'NOT': case 'BUF': g = { w: 60, h: 40, ins: [[0, 20]], out: [60, 20], body: [12, 3, 52, 37] }; break;
    default: {
      const n = nIns(c), h = Math.max(2, n) * 20, ins = [];
      for (let i = 0; i < n; i++) ins.push([0, 10 + 20 * i]);
      g = { w: 80, h, ins, out: [80, h / 2], body: [10, 0, 70, h] };
    }
  }
  if (GEOM.size > 500) GEOM.clear();
  GEOM.set(key, g);
  return g;
}
/** 含標籤文字的外框（匯出圖片、全部顯示時使用） */
function visualBox(c) {
  const g = geom(c);
  const b = { x1: c.x, y1: c.y, x2: c.x + g.w, y2: c.y + g.h };
  if (c.type === 'IN') b.x1 = c.x + 9 - textW(c.label || '?') - 4;
  if (c.type === 'OUT') b.x2 = c.x + 51 + textW(c.label || '?') + 4;
  if (isGate(c.type)) b.y2 += 16;
  return b;
}

const r1 = v => Math.round(v * 10) / 10;
function ln(x1, y1, x2, y2, color, sw = 2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}
function tx(x, y, s, o = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${o.anchor || 'middle'}" dominant-baseline="central" font-size="${o.size || 14}" font-weight="${o.weight || 600}" style="fill:${o.fill || 'currentColor'}"${o.extra || ''}>${esc(s)}</text>`;
}

/** 邏輯閘符號（本地座標：輸入接腳在 x=0，輸出接腳在 x=w） */
function gateSVG(type, n, col, iec) {
  const G = GATES[type], sw = col.sw || 2, o = [];
  const L = (x1, y1, x2, y2, c) => ln(x1, y1, x2, y2, c, sw);
  const shape = (d, fill) => `<path d="${d}" style="fill:${fill || 'none'};stroke:${col.stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const bubble = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="4.5" style="fill:${col.fill};stroke:${col.stroke}" stroke-width="${sw}"/>`;
  const label = (x, y, s) => tx(x, y, s, { fill: col.text || col.stroke, size: 15, weight: 800 });
  if (G.max === 1) {
    o.push(L(0, 20, 13, 20, col.inLead(0)));
    if (iec) {
      o.push(`<rect x="12" y="4" width="32" height="32" rx="2" style="fill:${col.fill};stroke:${col.stroke}" stroke-width="${sw}"/>`);
      o.push(label(28, 20.5, '1'));
      if (G.neg) { o.push(L(53, 20, 60, 20, col.outLead)); o.push(bubble(48.5, 20)); }
      else o.push(L(44, 20, 60, 20, col.outLead));
    } else {
      const tip = G.neg ? 46 : 50;
      if (G.neg) o.push(L(55, 20, 60, 20, col.outLead)); else o.push(L(tip, 20, 60, 20, col.outLead));
      o.push(shape(`M12,3 L${tip},20 L12,37 Z`, col.fill));
      if (G.neg) o.push(bubble(tip + 4.5, 20));
    }
    return o.join('');
  }
  const h = Math.max(2, n) * 20, hm = h / 2;
  let tip, leadEnd, body = null, extra = null;
  if (iec) { tip = 64; leadEnd = () => 13; }
  else if (type === 'AND' || type === 'NAND') {
    tip = 62; leadEnd = () => 11;
    body = `M10,0 H40 A22,${hm} 0 0 1 40,${h} H10 Z`;
  } else if (type === 'OR' || type === 'NOR') {
    tip = 64; leadEnd = y => 11 + 28 * (y / h) * (1 - y / h);
    body = `M10,0 C36,0 54,${r1(h * 0.12)} 64,${hm} C54,${r1(h * 0.88)} 36,${h} 10,${h} Q24,${hm} 10,0 Z`;
  } else {
    tip = 66; leadEnd = y => 7 + 28 * (y / h) * (1 - y / h);
    body = `M14,0 C38,0 56,${r1(h * 0.12)} 66,${hm} C56,${r1(h * 0.88)} 38,${h} 14,${h} Q28,${hm} 14,0 Z`;
    extra = `M6,${h} Q20,${hm} 6,0`;
  }
  for (let i = 0; i < n; i++) { const y = 10 + 20 * i; o.push(L(0, y, r1(leadEnd(y)), y, col.inLead(i))); }
  o.push(L(G.neg ? tip + 9 : tip, hm, 80, hm, col.outLead));
  if (iec) {
    o.push(`<rect x="12" y="0" width="52" height="${h}" rx="2" style="fill:${col.fill};stroke:${col.stroke}" stroke-width="${sw}"/>`);
    o.push(label(38, hm + 0.5, G.iec));
  } else {
    if (extra) o.push(shape(extra, null));
    o.push(shape(body, col.fill));
  }
  if (G.neg) o.push(bubble(tip + 4.5, hm));
  return o.join('');
}

/** 左側元件列的小圖示 */
function iconSVG(type, iec) {
  const col = { stroke: 'currentColor', fill: 'var(--surface)', inLead: () => 'currentColor', outLead: 'currentColor', text: 'currentColor' };
  if (isGate(type)) {
    const one = GATES[type].max === 1;
    return `<svg viewBox="${one ? '-6 -2 72 44' : '-4 -2 88 44'}" aria-hidden="true">${gateSVG(type, 2, col, iec)}</svg>`;
  }
  const S = s => `<svg viewBox="-2 -2 64 44" aria-hidden="true">${s}</svg>`;
  switch (type) {
    case 'IN': return S(`<line x1="48" y1="20" x2="60" y2="20" style="stroke:var(--hi)" stroke-width="2.4" stroke-linecap="round"/><rect x="16" y="6" width="32" height="28" rx="6" style="fill:var(--hi);stroke:var(--hi)" stroke-width="2"/>${tx(32, 21, '1', { fill: '#fff', size: 16, weight: 800 })}${tx(8, 21, 'A', { fill: 'currentColor', size: 15, weight: 800, anchor: 'end' })}`);
    case 'OUT': return S(`<line x1="0" y1="20" x2="16" y2="20" style="stroke:currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="20" r="13" style="fill:var(--surface);stroke:currentColor" stroke-width="2"/>${tx(30, 21, 'F', { fill: 'currentColor', size: 14, weight: 800 })}`);
    case 'CONST': return S(`<line x1="42" y1="20" x2="50" y2="20" style="stroke:currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12,8 H33 L42,20 L33,32 H12 Z" style="fill:var(--surface);stroke:currentColor" stroke-width="2" stroke-linejoin="round"/>${tx(24, 21, '1', { fill: 'var(--hi)', size: 15, weight: 800 })}`);
    case 'NOTE': return S(`<rect x="8" y="6" width="44" height="28" rx="4" style="fill:#FFF3BF;stroke:#E6CF8B" stroke-width="1.5"/><path d="M15,15 H45 M15,21 H45 M15,27 H34" style="stroke:#B08900" stroke-width="2" stroke-linecap="round"/>`);
  }
  return '';
}

/** 單一元件的 SVG（ctx: P 色盤、val 模擬結果、idx 連線索引、live 可互動、sel 選取、bad 錯誤標示、hot 高亮接腳） */
function compSVG(c, ctx) {
  const P = ctx.P, g = geom(c), live = !!ctx.live, o = [];
  const vcol = v => v === 1 ? P.hi : v === 0 ? P.lo : P.x;
  const myVal = ctx.val ? ctx.val.get(c.id) : undefined;
  const inVal = i => {
    const w = ctx.idx.driver.get(c.id + ':' + i);
    if (!w) return null;
    return ctx.val ? ctx.val.get(w.from) : undefined;
  };
  const leadCol = v => (v === null || v === undefined) ? P.stroke : vcol(v);
  o.push(`<g transform="translate(${c.x},${c.y})"${live ? ` data-comp="${c.id}"` : ''}>`);
  if (ctx.sel && ctx.sel.has(c.id)) {
    o.push(`<rect x="-7" y="-7" width="${g.w + 14}" height="${g.h + 14}" rx="8" style="fill:${P.sel};stroke:${P.sel}" fill-opacity="0.10" stroke-width="1.6"/>`);
  }
  if (ctx.bad && ctx.bad.has(c.id)) {
    o.push(`<rect x="-5" y="-5" width="${g.w + 10}" height="${g.h + 10}" rx="7" style="fill:none;stroke:${P.err}" stroke-width="1.6" stroke-dasharray="5 3"/>`);
  }
  if (live) o.push(`<rect x="0" y="0" width="${g.w}" height="${g.h}" fill="transparent"/>`);
  switch (c.type) {
    case 'IN': {
      const v = c.val ? 1 : 0;
      o.push(ln(48, 20, 60, 20, vcol(v), 2.2));
      o.push(`<rect x="16" y="6" width="32" height="28" rx="6" style="fill:${v ? P.hi : P.fill};stroke:${v ? P.hi : P.stroke}" stroke-width="2"${live ? ' data-toggle="1"' : ''}/>`);
      o.push(tx(32, 20.5, String(v), { fill: v ? '#FFFFFF' : P.text, size: 16, weight: 800, extra: ' pointer-events="none"' }));
      o.push(tx(9, 20.5, c.label || '?', { fill: c.fixed ? P.fixed : P.text, size: 17, weight: 800, anchor: 'end' }));
      break;
    }
    case 'OUT': {
      const v = myVal;
      o.push(ln(0, 20, 16, 20, leadCol(inVal(0)), 2.2));
      if (v === 1) o.push(`<circle cx="30" cy="20" r="19" style="fill:${P.hi}" fill-opacity="0.22"/>`);
      const fill = v === 1 ? P.hi : v === 0 ? P.ledOff : P.fill;
      o.push(`<circle cx="30" cy="20" r="14" style="fill:${fill};stroke:${v === 1 ? P.hi : P.stroke}" stroke-width="2"${v === 1 || v === 0 ? '' : ' stroke-dasharray="4 3"'}/>`);
      o.push(tx(30, 20.5, v === 1 ? '1' : v === 0 ? '0' : '?', { fill: v === 1 ? '#FFFFFF' : P.text, size: 15, weight: 800 }));
      o.push(tx(51, 20.5, c.label || '?', { fill: c.fixed ? P.fixed : P.text, size: 17, weight: 800, anchor: 'start' }));
      break;
    }
    case 'CONST': {
      const v = c.val ? 1 : 0;
      o.push(ln(34, 20, 40, 20, vcol(v), 2.2));
      o.push(`<path d="M4,8 H25 L34,20 L25,32 H4 Z" style="fill:${P.fill};stroke:${P.stroke}" stroke-width="2" stroke-linejoin="round"${live ? ' data-toggle="1"' : ''}/>`);
      o.push(tx(15.5, 20.5, String(v), { fill: v ? P.hi : P.text, size: 15, weight: 800, extra: ' pointer-events="none"' }));
      break;
    }
    case 'NOTE': {
      o.push(`<rect x="0" y="0" width="${g.w}" height="30" rx="5" style="fill:${P.noteBg};stroke:${P.noteLine}" stroke-width="1.2"/>`);
      o.push(tx(10, 15.5, c.text || '', { fill: P.text, size: 14, weight: 500, anchor: 'start' }));
      break;
    }
    default: {
      o.push(gateSVG(c.type, nIns(c), { stroke: P.stroke, fill: P.fill, inLead: i => leadCol(inVal(i)), outLead: leadCol(myVal), text: P.stroke }, ctx.iec));
      if (ctx.captions) o.push(tx(g.w / 2 - 3, g.h + 12, c.type, { fill: P.muted, size: 11, weight: 700 }));
      if (ctx.badges && myVal !== undefined) {
        o.push(tx(g.w - 5, g.h / 2 - 10, myVal === 1 ? '1' : myVal === 0 ? '0' : '?', { fill: vcol(myVal), size: 12, weight: 800 }));
      }
    }
  }
  g.ins.forEach(([px, py], i) => {
    if (!ctx.idx.driver.has(c.id + ':' + i)) o.push(`<circle cx="${px}" cy="${py}" r="3.6" style="fill:${P.fill};stroke:${P.warn}" stroke-width="1.8"/>`);
    if (ctx.hot && ctx.hot.has(c.id + ':' + i)) o.push(`<circle cx="${px}" cy="${py}" r="8" style="fill:${P.sel}" fill-opacity="0.45"/>`);
    if (live) o.push(`<circle cx="${px}" cy="${py}" r="9" class="pin" data-pin="${c.id}:${i}"/>`);
  });
  if (g.out) {
    const [px, py] = g.out;
    if (!ctx.idx.fanout.has(c.id)) o.push(`<circle cx="${px}" cy="${py}" r="3.2" style="fill:${P.fill};stroke:${P.muted}" stroke-width="1.6"/>`);
    if (ctx.hot && ctx.hot.has(c.id + ':o')) o.push(`<circle cx="${px}" cy="${py}" r="8" style="fill:${P.sel}" fill-opacity="0.45"/>`);
    if (live) o.push(`<circle cx="${px}" cy="${py}" r="9" class="pin" data-pin="${c.id}:o"/>`);
  }
  o.push('</g>');
  return o.join('');
}
