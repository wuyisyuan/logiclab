/*! LogicLab 邏輯閘練習 | 單檔前端應用（由 src/ 合併產生，請修改 src/ 後重新執行 build.sh） */
(function () {
'use strict';

/* ============================================================
 * 00 基本設定與工具函式
 * ============================================================ */
const APP = { name: 'LogicLab', version: '1.0.0' };
const CFG = Object.assign({ courseName: '數位邏輯設計', exercises: [] }, window.LOGIC_LAB_CONFIG || {});
const GRID = 10;
const X = 2;                 // 未知／浮接的邏輯值
const MAX_TT_INPUTS = 10;    // 真值表最多列舉的輸入數
const TT_SHOW_ROWS = 256;    // 真值表最多顯示的列數
const LS = 'logiclab.v1.';
const SUB_PREFIX = 'LGS1';   // 繳交代碼前綴
const ASG_PREFIX = 'LGA1';   // 作業連結代碼前綴

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const snap = v => Math.round(v / GRID) * GRID;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return e;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escText(s) { return esc(s).replace(/\n/g, '<br>'); }

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function hash2(str) { return fnv1a(str) + fnv1a('§' + str + str.length); }

function stableStringify(v) {
  if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** 把物件壓縮成可貼上的文字代碼：前綴 + z(壓縮)/j(未壓縮) + base64url */
async function packCode(prefix, obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    try { return prefix + 'z' + bytesToB64url(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* 改用未壓縮格式 */ }
  }
  return prefix + 'j' + bytesToB64url(raw);
}
async function unpackCode(code, prefix) {
  code = String(code || '').trim();
  const i = code.indexOf(prefix);
  if (i < 0) throw new Error('代碼格式不正確');
  code = code.slice(i + prefix.length);
  const mode = code[0];
  const m = /^[A-Za-z0-9_-]+/.exec(code.slice(1));
  if (!m) throw new Error('代碼是空的');
  const bytes = b64urlToBytes(m[0]);
  let text;
  if (mode === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('此瀏覽器不支援解壓縮，請改用新版 Chrome／Edge');
    try { text = new TextDecoder().decode(await streamBytes(bytes, new DecompressionStream('deflate-raw'))); }
    catch (e) { throw new Error('代碼不完整或已損毀（可能複製時少了一部分）'); }
  } else if (mode === 'j') {
    text = new TextDecoder().decode(bytes);
  } else throw new Error('代碼格式不正確');
  try { return JSON.parse(text); } catch (e) { throw new Error('代碼內容無法解析'); }
}

function download(filename, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 改用舊方法 */ }
  const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0;opacity:0' });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(LS + k); } catch (e) { /* ignore */ } },
  keys(prefix) {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(LS + prefix)) out.push(k.slice(LS.length)); } } catch (e) { /* ignore */ }
    return out;
  }
};

function toast(msg, kind = 'info', ms = 2800) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = el('div', { class: 'toast ' + kind, role: 'status' }, msg);
  box.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

function naturalCompare(a, b) { return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' }); }
function sanitizeFilename(s) { return String(s || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'file'; }
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function stampForFile(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}
function isTyping(t) {
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function bitsOf(r, n) { const a = []; for (let i = 0; i < n; i++) a.push((r >> (n - 1 - i)) & 1); return a; }

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

/* ============================================================
 * 07 導線繞線：直角（避開元件、避免不同訊號重疊）或曲線
 * ============================================================ */
function pinPos(c, pin) {
  const g = geom(c), p = pin < 0 ? g.out : g.ins[pin];
  return p ? [c.x + p[0], c.y + p[1]] : [c.x, c.y];
}
function ptsToD(pts) { return 'M' + pts.map(p => p[0] + ',' + p[1]).join(' L'); }

function routeWires(circ, idx, mode) {
  const paths = new Map(), dots = [];
  const wires = circ.wires.filter(w => idx.byId.has(w.from) && idx.byId.has(w.to));
  if (mode === 'curve') {
    for (const w of wires) {
      const [sx, sy] = pinPos(idx.byId.get(w.from), -1), [tx, ty] = pinPos(idx.byId.get(w.to), w.pin);
      const dx0 = tx - sx;
      const dx = dx0 >= 30 ? Math.max(25, dx0 * 0.5) : 40 + Math.min(140, Math.abs(ty - sy) * 0.35 + (sx - tx) * 0.3);
      paths.set(w.id, { d: `M${sx},${sy} C${r1(sx + dx)},${sy} ${r1(tx - dx)},${ty} ${tx},${ty}` });
    }
    return { paths, dots };
  }

  const bodies = [], pins = [];
  for (const c of circ.comps) {
    if (c.type === 'NOTE') continue;
    const g = geom(c);
    bodies.push([c.x + 1, c.y + 1, c.x + g.w - 1, c.y + g.h - 1]);
    if (g.out) pins.push([c.x + g.out[0], c.y + g.out[1], c.id]);
    g.ins.forEach((p, i) => { const w = idx.driver.get(c.id + ':' + i); pins.push([c.x + p[0], c.y + p[1], w ? w.from : null]); });
  }
  const H = [], V = [];   // [座標, 起點, 終點, 訊號]
  const segsOf = pts => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      if (x1 === x2 && y1 === y2) continue;
      if (y1 === y2) out.push([0, y1, Math.min(x1, x2), Math.max(x1, x2)]);
      else out.push([1, x1, Math.min(y1, y2), Math.max(y1, y2)]);
    }
    return out;
  };
  const segCost = (s, net) => {
    const o = s[0], c = s[1], a = s[2], b = s[3];
    let cost = 0;
    const same = o === 0 ? H : V, perp = o === 0 ? V : H;
    for (const t of same) {
      if (t[3] === net || t[0] !== c) continue;
      if (t[1] <= b && a <= t[2]) cost += 1000;               // 不同訊號重疊
      else if (t[1] <= b + 20 && a - 20 <= t[2]) cost += 250;  // 同一直線上太接近，看起來像連在一起
    }
    for (const t of perp) {
      if (t[3] === net) continue;
      const tc = t[0];
      if (tc < a || tc > b || c < t[1] || c > t[2]) continue;
      cost += (tc > a && tc < b && c > t[1] && c < t[2]) ? 4 : 400;   // 十字交叉 vs. 看起來像接在一起
    }
    for (const bd of bodies) {
      if (o === 0 ? (c > bd[1] && c < bd[3] && a < bd[2] && b > bd[0]) : (c > bd[0] && c < bd[2] && a < bd[3] && b > bd[1])) cost += 90;
    }
    for (const p of pins) {
      if (p[2] === net) continue;
      if (o === 0 ? (p[1] === c && p[0] >= a && p[0] <= b) : (p[0] === c && p[1] >= a && p[1] <= b)) cost += 600;
    }
    return cost;
  };

  for (const w of wires) {
    const src = idx.byId.get(w.from), dst = idx.byId.get(w.to), net = w.from;
    const [sx, sy] = pinPos(src, -1), [tx, ty] = pinPos(dst, w.pin);
    let best = null, bestCost = Infinity;
    const consider = (pts, bias) => {
      let cost = bias;
      if (cost >= bestCost) return;
      for (const s of segsOf(pts)) { cost += segCost(s, net); if (cost >= bestCost) return; }
      bestCost = cost; best = pts;
    };
    if (tx - sx >= 20) {
      if (sy === ty) consider([[sx, sy], [tx, ty]], 0);
      const pref = tx - 20;
      for (let vx = tx - 10; vx >= sx + 10; vx -= 10) consider([[sx, sy], [vx, sy], [vx, ty], [tx, ty]], 2 + Math.abs(vx - pref) * 0.06);
    } else {
      const gs = geom(src), gd = geom(dst);
      const bA = [src.x, src.y, src.x + gs.w, src.y + gs.h], bB = [dst.x, dst.y, dst.x + gd.w, dst.y + gd.h];
      const ys = new Set([snap(Math.min(bA[1], bB[1]) - 20), snap(Math.max(bA[3], bB[3]) + 20)]);
      if (bA[3] + 20 <= bB[1]) ys.add(snap((bA[3] + bB[1]) / 2));
      if (bB[3] + 20 <= bA[1]) ys.add(snap((bB[3] + bA[1]) / 2));
      for (const ym of ys) {
        for (let i = 1; i <= 4; i++) {
          for (let j = 1; j <= 4; j++) {
            const x1 = sx + 10 * i, x2 = tx - 10 * j;
            consider([[sx, sy], [x1, sy], [x1, ym], [x2, ym], [x2, ty], [tx, ty]], 10 + (i + j) * 0.5 + Math.abs(ym - (sy + ty) / 2) * 0.02);
          }
        }
      }
    }
    if (!best) best = [[sx, sy], [tx, ty]];
    for (const s of segsOf(best)) (s[0] === 0 ? H : V).push([s[1], s[2], s[3], net]);
    paths.set(w.id, { pts: best });
  }

  // 同一訊號分岔的地方畫接點（格點上有 3 個以上方向相連）
  const nets = new Map();
  const or = (m, x, y, bit) => { const k = x + ',' + y; m.set(k, (m.get(k) || 0) | bit); };
  for (const w of wires) {
    const pts = paths.get(w.id).pts;
    let m = nets.get(w.from);
    if (!m) nets.set(w.from, m = new Map());
    for (let i = 0; i < pts.length - 1; i++) {
      let [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      if (y1 === y2 && x1 !== x2) {
        if (x1 > x2) [x1, x2] = [x2, x1];
        for (let x = x1; x < x2; x += GRID) { or(m, x, y1, 2); or(m, Math.min(x + GRID, x2), y1, 1); }
      } else if (x1 === x2 && y1 !== y2) {
        if (y1 > y2) [y1, y2] = [y2, y1];
        for (let y = y1; y < y2; y += GRID) { or(m, x1, y, 8); or(m, x1, Math.min(y + GRID, y2), 4); }
      }
    }
  }
  for (const [net, m] of nets) {
    for (const [k, mask] of m) {
      let bits = 0;
      for (let v = mask; v; v >>= 1) bits += v & 1;
      if (bits >= 3) { const [x, y] = k.split(',').map(Number); dots.push([x, y, net]); }
    }
  }
  return { paths, dots };
}

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

/* ============================================================
 * 10 繳交、存檔、匯出圖片
 * ============================================================ */
function readStudent() { return { id: $('#stuId').value.trim().slice(0, 20), name: $('#stuName').value.trim().slice(0, 20) }; }
function validateStudent() {
  const s = readStudent(), err = $('#stuErr');
  if (!s.id || !s.name) {
    err.textContent = '請先填寫學號與姓名';
    err.hidden = false;
    setTab('submit');
    openPanelOnMobile();
    (s.id ? $('#stuName') : $('#stuId')).focus();
    return null;
  }
  err.hidden = true;
  store.set('student', s);
  return s;
}
function subSig(sub) { const c = Object.assign({}, sub); delete c.sig; return hash2(stableStringify(c)); }
function buildSubmission(student) {
  const a = S.asg;
  const res = a ? checkCircuit(a, S.circ) : null;
  const sub = {
    app: 'logiclab', kind: 'submission', v: 1, ver: APP.version,
    student: { id: String(student.id || ''), name: String(student.name || '') },
    assignment: a ? compactAssignment(a, false) : null,
    circuit: toCompact(S.circ),
    meta: { createdAt: S.meta.createdAt, submittedAt: new Date().toISOString(), edits: S.meta.edits, activeSec: Math.round(S.meta.activeSec) },
    self: res && a.selfCheck ? { pass: res.pass, correct: res.correct, total: res.total, gates: res.gateCount } : null
  };
  sub.sig = subSig(sub);
  return sub;
}
/** 檔名只用英數字（學號_題目代號），避免部分系統或教學平台無法處理中文檔名；姓名存在檔案內容裡 */
function subBaseName(st) {
  const sid = String(st.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'student';
  return `${sid}_${S.asg ? S.asg.id : 'free'}`;
}
function downloadSubmission() {
  const st = validateStudent();
  if (!st) return;
  const sub = buildSubmission(st);
  const name = subBaseName(st) + '.json';
  download(name, JSON.stringify(sub, null, 1), 'application/json');
  toast('已下載作業檔：' + name, 'ok');
}
async function copySubmissionCode() {
  const st = validateStudent();
  if (!st) return;
  const code = await packCode(SUB_PREFIX, buildSubmission(st));
  $('#codeBox').hidden = false;
  const ta = $('#codeText');
  ta.value = code;
  const ok = await copyText(code);
  if (ok) toast(`已複製繳交代碼（${code.length} 個字元），請貼到表單`, 'ok');
  else { toast('無法自動複製，請全選下方代碼後手動複製', 'warn', 4000); ta.focus(); ta.select(); }
}

/* ---------- 電路檔 ---------- */
function saveCircuitFile() {
  const data = {
    app: 'logiclab', kind: 'circuit', v: 1, ver: APP.version, savedAt: new Date().toISOString(),
    assignment: S.asg ? compactAssignment(S.asg, !S.asg.builtin) : null,
    circuit: toCompact(S.circ)
  };
  const name = `logiclab_${S.asg ? S.asg.id : 'free'}_${stampForFile()}.json`;
  download(name, JSON.stringify(data), 'application/json');
  toast('已儲存電路檔：' + name, 'ok');
}
async function openCircuitFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('檔案格式不正確（需要 LogicLab 的 .json 檔）', 'err'); return; }
  if (!data || data.app !== 'logiclab' || !data.circuit) { toast('這不是 LogicLab 的電路檔或作業檔', 'err'); return; }
  if (data.assignment) {
    try {
      const emb = expandAssignment(data.assignment);
      const target = BUILTIN.has(emb.id) ? BUILTIN.get(emb.id) : emb;
      if (!S.asg || S.asg.hash !== target.hash) await openAssignmentObject(target);
    } catch (e) { /* 題目資料有問題時，只載入電路 */ }
  }
  replaceCircuit(fromCompact(data.circuit));
  toast('已開啟：' + file.name, 'ok');
}

/* ---------- 匯出圖片 ---------- */
function exportSVGString(circ, opts = {}) {
  const P = PAL_LIGHT;
  const comp = compile(circ), val = comp.run(null);
  const R = routeWires(circ, comp.idx, opts.wire || 'ortho');
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const grow = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
  for (const c of circ.comps) { const b = visualBox(c); grow(b.x1, b.y1, b.x2, b.y2); }
  for (const r of R.paths.values()) if (r.pts) for (const [x, y] of r.pts) grow(x, y, x, y);
  if (!isFinite(x1)) { x1 = 0; y1 = 0; x2 = 240; y2 = 120; }
  const m = 24, headH = opts.title ? 60 : 0;
  const cw = x2 - x1 + 2 * m, ch = y2 - y1 + 2 * m;
  let ttSvg = '', ttW = 0, ttH = 0;
  if (opts.tt) {
    const tt = truthTable(circ, opts.asg, comp);
    if (tt.ins.length && tt.ins.length <= 5 && tt.outs.length && tt.outs.length <= 6) {
      const cols = [...tt.ins.map(c => c.label), ...tt.outs.map(c => c.label)];
      const cwid = Math.max(30, ...cols.map(s => textW(s, 14) + 14)), rh = 21;
      ttW = cols.length * cwid; ttH = (tt.rows.length + 1) * rh;
      const ox = cw + 8, oy = headH + m;
      const o = [`<g transform="translate(${ox},${oy})" font-family="Consolas, Menlo, monospace">`];
      o.push(`<rect x="0" y="0" width="${ttW}" height="${rh}" fill="#F3F7FA"/>`);
      cols.forEach((s, i) => o.push(tx(i * cwid + cwid / 2, rh / 2, s, { fill: i < tt.ins.length ? P.text : '#2683C6', size: 13, weight: 800 })));
      tt.rows.forEach((row, ri) => {
        const y = (ri + 1) * rh;
        [...row.ins, ...row.outs].forEach((v, i) => {
          const isOut = i >= tt.ins.length;
          o.push(tx(i * cwid + cwid / 2, y + rh / 2, v === 1 ? '1' : v === 0 ? '0' : '?', { fill: isOut && v === 1 ? P.hi : P.text, size: 13, weight: isOut ? 800 : 500 }));
        });
        o.push(`<line x1="0" y1="${y}" x2="${ttW}" y2="${y}" stroke="#C9D6E0" stroke-width="1"/>`);
      });
      o.push(`<line x1="${tt.ins.length * cwid}" y1="0" x2="${tt.ins.length * cwid}" y2="${ttH}" stroke="#9FB3C3" stroke-width="2"/>`);
      o.push(`<rect x="0" y="0" width="${ttW}" height="${ttH}" fill="none" stroke="#9FB3C3" stroke-width="1.2" rx="3"/></g>`);
      ttSvg = o.join('');
    }
  }
  const W = Math.ceil(Math.max(cw + (ttW ? ttW + 24 : 0), opts.title ? 420 : 0));
  const H = Math.ceil(headH + Math.max(ch, ttH ? ttH + 2 * m : 0));
  const vcol = v => v === 1 ? P.hi : v === 0 ? P.lo : P.x;
  const wires = [];
  for (const w of circ.wires) {
    const r = R.paths.get(w.id);
    if (!r) continue;
    const v = val.get(w.from);
    wires.push(`<path d="${r.d || ptsToD(r.pts)}" style="stroke:${vcol(v)}" stroke-width="${v === 1 ? 3 : 2.4}" fill="none" stroke-linejoin="round" stroke-linecap="round"${v === 1 || v === 0 ? '' : ' stroke-dasharray="6 4"'}/>`);
  }
  for (const [x, y, net] of R.dots) wires.push(`<circle cx="${x}" cy="${y}" r="3.8" style="fill:${vcol(val.get(net))}"/>`);
  const ctx = { P, val, idx: comp.idx, live: false, iec: !!opts.iec, captions: !!opts.captions, badges: false, hot: null };
  const comps = circ.comps.map(c => compSVG(c, ctx)).join('');
  const head = opts.title
    ? tx(16, 22, opts.title, { fill: '#335B74', size: 18, weight: 800, anchor: 'start' }) + tx(16, 45, opts.subtitle || '', { fill: '#6B7F8E', size: 13, weight: 500, anchor: 'start' }) +
      `<line x1="0" y1="${headH - 1}" x2="${W}" y2="${headH - 1}" stroke="#E1E8EE" stroke-width="1"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Microsoft JhengHei, PingFang TC, Noto Sans TC, Noto Sans CJK TC, Heiti TC, sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/>${head}<g transform="translate(${r1(m - x1)},${r1(headH + m - y1)})">${wires.join('')}${comps}</g>${ttSvg}</svg>`;
  return { svg, W, H };
}
async function svgToPng(svg, W, H, scale = 2) {
  scale = Math.min(scale, 8000 / Math.max(W, H));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('圖片產生失敗')); img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    const g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('圖片產生失敗'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
function currentExportSVG(withHeader, student) {
  const a = S.asg;
  const sub = [student ? `${student.id} ${student.name}` : null, fmtTime(new Date().toISOString()), 'LogicLab'].filter(Boolean).join('　·　');
  return exportSVGString(S.circ, {
    title: withHeader ? (a ? a.title : '邏輯電路') : null, subtitle: sub, asg: a, tt: withHeader,
    iec: S.settings.symbol === 'iec', wire: S.settings.wire, captions: false
  });
}
async function exportPNG(forSubmit) {
  let st = null;
  if (forSubmit) { st = validateStudent(); if (!st) return; }
  if (!S.circ.comps.length) { toast('畫布是空的', 'warn'); return; }
  try {
    const { svg, W, H } = currentExportSVG(true, st);
    const blob = await svgToPng(svg, W, H, 2);
    const name = st ? subBaseName(st) + '.png' : `logiclab_${S.asg ? S.asg.id : 'free'}_${stampForFile()}.png`;
    download(name, blob, 'image/png');
    toast('已下載電路圖：' + name, 'ok');
  } catch (e) { toast('圖片產生失敗：' + e.message, 'err'); }
}
async function copyImage() {
  if (!S.circ.comps.length) { toast('畫布是空的', 'warn'); return; }
  const { svg, W, H } = currentExportSVG(false, null);
  const pngPromise = svgToPng(svg, W, H, 3);
  try {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('unsupported');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise })]);
    toast('電路圖已複製，可以直接貼到簡報或文件', 'ok');
  } catch (e) {
    try { download(`logiclab_${stampForFile()}.png`, await pngPromise, 'image/png'); toast('瀏覽器不允許複製圖片，已改為下載 PNG', 'warn'); }
    catch (e2) { toast('圖片產生失敗', 'err'); }
  }
}

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
})();
