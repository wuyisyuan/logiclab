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
