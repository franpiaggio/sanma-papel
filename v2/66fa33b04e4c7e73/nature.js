import { rng } from 'papercraft/lib/paperkit-2d.js';

// Original cut-paper vegetation for San Martín de los Andes. Six silhouettes and
// print plates per kind; every placed tree shares a plate with its slotted cross.
const C = {
  deep: '#28634e', mid: '#5e944b', light: '#a8bc56', wood: '#99663c',
  gold: '#e5b94e', cream: '#f3e7bd', bark: '#c79a54', ink: '#284e3c',
  stone: '#a1a79b', stoneLight: '#cbc8b5', stoneDark: '#737e76', berry: '#af775c',
};
const TAU = Math.PI * 2;
const layer = { depth: 0.55, lip: 0.8, shadow: 0.72, shade: 0.45, rim: 0, lipColor: C.cream };

function ellipse(cx, cy, rx, ry, angle = 0, count = 18) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    return [cx + x * ca - y * sa, cy + x * sa + y * ca];
  });
}
function fillPoly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath(); g.fill();
}
function leaf(cx, cy, length, width, angle = 0) {
  const ca = Math.cos(angle), sa = Math.sin(angle), pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = (t - 0.5) * length, y = Math.sin(t * Math.PI) * width / 2;
    pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
  }
  for (let i = 7; i > 0; i--) {
    const t = i / 8, x = (t - 0.5) * length, y = -Math.sin(t * Math.PI) * width / 2;
    pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
  }
  return pts;
}
function bough(x0, y0, x1, y1, width) {
  const d = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
  return [[x0 + nx * width, y0 + ny * width], [x1 + nx * width * 0.38, y1 + ny * width * 0.38],
    [x1 - nx * width * 0.38, y1 - ny * width * 0.38], [x0 - nx * width, y0 - ny * width]];
}
function variantOf(seed) {
  const n = Math.trunc(Number(seed) || 1);
  return ((n % 6) + 6) % 6;
}

function coihuePlate(v) {
  const r = rng(4109 + v * 193), h = 5.7 + r() * 1.0, rx = 2.0 + r() * 0.43;
  const cy = h * 0.65, ry = h - cy, lean = (r() - 0.5) * 0.25, phase = r() * TAU;
  const crown = (a) => {
    const f = 1 + 0.058 * Math.sin(a * 7 + phase) + 0.027 * Math.cos(a * 11 - phase);
    return [lean + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f];
  };
  // 36 points still trace the 7- and 11-lobe ripple; 56 cost ~35% more triangles per tree
  const crownPts = Array.from({ length: 36 }, (_, i) => crown(i / 36 * TAU));
  const cut = [[-0.27, 0], [0.29, 0]];
  // Join the trunk on either side of the crown's bottom arc; joining below its
  // scalloped edge would let the outline double back on itself in two variants.
  for (let i = 0; i <= 34; i++) cut.push(crown(-Math.PI / 2 + 0.3 + (TAU - 0.6) * i / 34));
  const leaves = [];
  // Golden-angle placement reads as a hand-arranged canopy, with countable leaves.
  for (let i = 0; i < 21; i++) {
    const a = i * 2.39996 + phase, q = Math.sqrt((i + 0.5) / 21) * 0.78;
    const x = lean + Math.cos(a) * rx * q, y = cy + Math.sin(a) * ry * q;
    leaves.push({ pts: leaf(x, y, 0.64 + r() * 0.27, 0.27 + r() * 0.16, a * 0.35 + 0.3), tone: i % 7 === 0 ? C.gold : [C.light, C.mid, '#b0b790'][i % 3] });
  }
  const limbs = [-1, 1, -1, 1, -1, 1].map((side, i) => {
    const y = cy - ry * 0.55 + i * ry * 0.2;
    return bough(lean * 0.4, y - 0.48, lean + side * rx * (0.5 + r() * 0.15), y + 0.58, 0.105);
  });
  return {
    cut, h,
    paint(P) {
      P.fill(C.wood);
      P.layer(crownPts, C.deep, layer);
      P.layer(ellipse(lean - rx * 0.24, cy + ry * 0.13, rx * 0.76, ry * 0.81, -0.16), C.mid, layer);
      P.layer(ellipse(lean + rx * 0.34, cy - ry * 0.17, rx * 0.61, ry * 0.65, 0.2), '#54735a', layer);
      P.layer(g => {
        fillPoly(g, [[-0.27, 0], [0.29, 0], [0.17 + lean, cy + ry * 0.45], [-0.07 + lean, cy + ry * 0.45]]);
        limbs.forEach(p => fillPoly(g, p));
      }, C.wood, { ...layer, depth: 0.45 });
      P.layer([[-0.16, 0.12], [-0.03, 0.1], [0.05 + lean, cy + 0.8], [-0.05 + lean, cy + 0.8]], C.bark, { ...layer, depth: 0.3, shadow: 0.35 });
      for (let k = 0; k < 3; k++) P.layer(g => {
        leaves.filter((_, i) => i % 3 === k).forEach(item => { g.fillStyle = item.tone; fillPoly(g, item.pts); });
      }, C.light, { ...layer, depth: 0.45 });
      P.draw(g => {
        g.strokeStyle = 'rgba(237,228,200,0.32)'; g.lineWidth = 0.035;
        for (let i = 0; i < leaves.length; i += 3) {
          const p = leaves[i].pts, a = p[0], b = p[8];
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        }
      });
    },
  };
}

function cipresPlate(v) {
  const r = rng(9001 + v * 137), h = 6.05 + r() * 0.88, w = 1.85 + r() * 0.38;
  const tiers = Array.from({ length: 6 }, (_, i) => {
    const y = 0.9 + i * (h - 1.2) / 6, half = w / 2 * (1 - i * 0.125), top = Math.min(h, y + 1.45);
    return { y, half, top, offset: (r() - 0.5) * 0.12 };
  });
  const right = [];
  for (let i = 0; i < tiers.length; i++) {
    const q = tiers[i]; right.push([q.half + q.offset, q.y], [q.half * 0.65 + q.offset, q.y + 0.55]);
  }
  const left = tiers.slice().reverse().flatMap(q => [[-q.half * 0.68 + q.offset, q.y + 0.55], [-q.half + q.offset, q.y]]);
  const cut = [[-0.18, 0], [0.18, 0], [0.2, 0.94], ...right, [0.1, h], [-0.08, h - 0.01], ...left, [-0.2, 0.94]];
  return {
    cut, h,
    paint(P) {
      P.fill(C.wood);
      P.layer([[0, 0.8], [w * 0.58, 0.95], [0.1, h], [-0.1, h], [-w * 0.58, 0.95]], C.deep, layer);
      tiers.forEach((q, i) => {
        const p = [[q.offset - q.half, q.y], [q.offset - q.half * 0.45, q.y + 0.18],
          [q.offset, q.top], [q.offset + q.half * 0.45, q.y + 0.2], [q.offset + q.half, q.y],
          [q.offset + q.half * 0.3, q.y - 0.06]];
        P.layer(p, [C.deep, C.mid, '#54725e'][i % 3], { ...layer, depth: 0.55 });
        P.layer(g => {
          for (let j = 0; j < 3; j++) {
            const x = q.offset + (j - 1) * q.half * 0.4, y = q.y + 0.24 + (j === 1 ? 0.25 : 0);
            fillPoly(g, leaf(x, y, 0.53, 0.2, 0.9 + (j - 1) * 0.55));
          }
        }, i % 3 === 2 ? '#b3b68c' : C.light, { ...layer, depth: 0.28, lip: 0.6 });
      });
      P.layer([[-0.11, 0], [-0.02, 0], [0.05, 1.52], [-0.03, 1.6]], C.bark, { ...layer, depth: 0.2 });
      P.layer(g => {
        g.fillStyle = C.gold;
        [1, 3, 4].forEach(i => { const q = tiers[i]; fillPoly(g, ellipse(q.half * 0.4, q.y + 0.17, 0.075, 0.11)); });
      }, C.gold, { ...layer, depth: 0.2 });
    },
  };
}

function shrubPlate(v) {
  const r = rng(7003 + v * 101), w = 1.9 + r() * 0.4, h = 1.08 + r() * 0.22;
  const cut = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * Math.PI, f = 1 + 0.07 * Math.sin(a * 7 + v);
    cut.push([Math.cos(a) * w / 2 * f, 0.08 + Math.sin(a) * h * f]);
  }
  const leaves = Array.from({ length: 12 }, (_, i) => {
    const x = (r() - 0.5) * w * 0.85, y = 0.23 + r() * h * 0.65;
    return { pts: leaf(x, y, 0.5 + r() * 0.15, 0.21 + r() * 0.1, r() * Math.PI), c: [C.mid, C.light, C.gold][i % 3] };
  });
  return { cut, h, paint(P) {
    P.fill(C.deep);
    P.layer(ellipse(-0.18, h * 0.5, w * 0.41, h * 0.48), C.mid, { ...layer, depth: 0.32 });
    for (let k = 0; k < 3; k++) P.layer(g => {
      leaves.filter((_, i) => i % 3 === k).forEach(q => { g.fillStyle = q.c; fillPoly(g, q.pts); });
    }, C.light, { ...layer, depth: 0.22 });
    P.layer(g => {
      for (let i = 0; i < 5; i++) fillPoly(g, ellipse((i - 2) * w * 0.14, 0.28 + (i % 2) * 0.29, 0.07, 0.075));
    }, v % 2 ? C.berry : C.cream, { ...layer, depth: 0.2 });
  } };
}

function rockPlate(v) {
  const r = rng(2003 + v * 223), w = 1.45 + r() * 0.45, h = 0.85 + r() * 0.28;
  const cut = [[-w * 0.52, 0], [w * 0.53, 0], [w * 0.45, h * 0.55], [w * 0.12, h], [-w * 0.27, h * 0.93], [-w * 0.5, h * 0.45]];
  return { cut, h, paint(P) {
    P.fill(C.stoneDark);
    P.layer([cut[0], [-w * 0.12, h * 0.35], [w * 0.12, h], cut[4], cut[5]], C.stone, { ...layer, depth: 0.34 });
    P.layer([[w * 0.12, h], [-w * 0.12, h * 0.35], [w * 0.42, h * 0.4], cut[2]], C.stoneLight, { ...layer, depth: 0.23 });
    P.layer([[w * 0.12, 0], [w * 0.42, h * 0.4], [w * 0.53, 0]], '#899489', { ...layer, depth: 0.3 });
    P.layer(g => {
      fillPoly(g, ellipse(-w * 0.28, h * 0.2, w * 0.2, h * 0.12, 0.25));
      fillPoly(g, ellipse(-w * 0.36, h * 0.37, w * 0.1, h * 0.13, -0.25));
    }, C.mid, { ...layer, depth: 0.25 });
    P.layer(ellipse(-w * 0.24, h * 0.2, w * 0.1, h * 0.055), C.gold, { ...layer, depth: 0.16 });
  } };
}

function flowerPlate(v) {
  const r = rng(1607 + v * 47), w = 0.87 + r() * 0.18, h = 0.65 + r() * 0.12;
  // The stems and flowers remain one connected, broad card rather than thin wires.
  const cut = [[-w * 0.43, 0], [w * 0.43, 0], [w * 0.45, h * 0.35], [w * 0.3, h * 0.5], [w * 0.47, h * 0.76],
    [w * 0.28, h * 0.94], [w * 0.08, h * 0.78], [-0.05, h], [-w * 0.25, h * 0.9], [-w * 0.18, h * 0.65],
    [-w * 0.44, h * 0.73], [-w * 0.54, h * 0.49], [-w * 0.35, h * 0.27]];
  const heads = [[-w * 0.32, h * 0.51], [-w * 0.04, h * 0.8], [w * 0.28, h * 0.72]];
  return { cut, h, paint(P) {
    P.fill(C.mid);
    P.layer(g => {
      fillPoly(g, leaf(-w * 0.15, h * 0.23, 0.36, 0.14, 0.5));
      fillPoly(g, leaf(w * 0.17, h * 0.36, 0.34, 0.14, -0.4));
      heads.forEach(([x, y]) => fillPoly(g, bough(x * 0.3, 0, x, y, 0.026)));
    }, C.light, { ...layer, depth: 0.16 });
    P.layer(g => {
      heads.forEach(([x, y], k) => {
        g.fillStyle = (v + k) % 3 === 0 ? C.cream : C.gold;
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * TAU; fillPoly(g, ellipse(x + Math.cos(a) * 0.075, y + Math.sin(a) * 0.075, 0.09, 0.058, a, 10));
        }
      });
    }, C.gold, { ...layer, depth: 0.14 });
    P.layer(g => heads.forEach(([x, y]) => fillPoly(g, ellipse(x, y, 0.045, 0.045, 0, 10))), C.berry, { ...layer, depth: 0.12 });
  } };
}

export function createNature(H) {
  const plates = new Map();
  function plate(kind, seed) {
    const variant = variantOf(seed), key = `${kind}:${variant}`;
    if (!plates.has(key)) {
      const maker = { coihue: coihuePlate, cipres: cipresPlate, shrub: shrubPlate, rocks: rockPlate, flowers: flowerPlate }[kind];
      const p = maker(variant), cross = kind === 'coihue' || kind === 'cipres';
      p.materials = H.printed(p.cut, p.paint, { cross, res: cross ? 0.8 : 1 });
      plates.set(key, p);
    }
    return plates.get(key);
  }
  function place(kind, x, z, { seed = 1, scale = 1 } = {}) {
    const p = plate(kind, seed), r = rng(Math.trunc(seed) * 8191 + 97), cross = kind === 'coihue' || kind === 'cipres';
    const h = H.popup(p.cut, null, {
      x, z, scale: scale * (0.94 + r() * 0.12), materials: p.materials,
      cross, sway: cross ? (kind === 'cipres' ? 0.09 : 0.13) : kind === 'rocks' ? 0 : 0.06,
      solid: cross ? 0.25 : 0, edge: cross ? 0.065 : 0.035,
    });
    h.group.name = `${kind}-${Math.trunc(seed)}`;
    return h;
  }
  return {
    tree(x, z, { kind = 'coihue', seed = 1, scale = 1 } = {}) {
      return place(kind === 'cipres' || kind === 'ciprés' || kind === 'cypress' ? 'cipres' : 'coihue', x, z, { seed, scale });
    },
    shrub: (x, z, opts = {}) => place('shrub', x, z, opts),
    rocks: (x, z, opts = {}) => place('rocks', x, z, opts),
    flowers: (x, z, opts = {}) => place('flowers', x, z, opts),
  };
}
