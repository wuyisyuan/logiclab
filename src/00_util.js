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
