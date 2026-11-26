/**
 * Instanced drawing for the paper town.
 *
 * Every card is its own mesh with up to three material groups (front print,
 * cut edge, back): ~30k meshes and ~100k draws. Infill houses come from five
 * master models and trees from shared plates, so most cards repeat exactly.
 * Each (material, sub-geometry) pair becomes one THREE.InstancedMesh: one real
 * GPU-instanced draw call for every copy (~300 calls for ~97k copies).
 * Geometries are deduplicated by content (identical extrusions share one) and
 * welded into indexed form (ExtrudeGeometry is non-indexed).
 *
 * Why not BatchedMesh: Chrome on macOS (ANGLE on Metal) emulates its
 * multi-draw one draw per instance, so ~98k driver draws a frame (~20 fps).
 *
 * Motion is preserved exactly: the original meshes stay in the scene graph
 * (hidden), the harness keeps animating their hinges, sway and follow() links,
 * and moving instances copy their source mesh's world matrix every frame.
 * Settled hinges are frozen (no matrix updates) and wind sway runs only near
 * the camera target in close shots.
 */
export function createBatcher(H, { minInstances = 3 } = {}) {
  const THREE = H.THREE;
  const scene = H.scene;
  scene.updateMatrixWorld(true);

  // Candidates: opaque, non-mirrored meshes on the default layer.
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isBatchedMesh || o.isInstancedMesh || o.isSkinnedMesh || o.layers.mask !== 1) return;
    if (!o.geometry?.attributes?.position || o.userData.detailGround) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !m || m.transparent || !(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial))) return;
    if (o.matrixWorld.determinant() < 0) return;
    meshes.push(o);
  });

  // Split each geometry into one sub-geometry per material group (cached: the
  // infill clones share their master's geometry, so it is split once).
  const parts = new Map();   // geometry.uuid -> [{ material index, geometry }]
  // Identical cards are built as separate geometries (every tree from one plate
  // extrudes its own copy). Key geometries by content so copies share one
  // instanced draw: an FNV hash of every attribute's raw bits plus the groups.
  const byContent = new Map();
  function contentKey(geo) {
    let h = 2166136261 >>> 0, n = 0;
    const mix = (v) => { h ^= v; h = Math.imul(h, 16777619) >>> 0; };
    for (const name of Object.keys(geo.attributes).sort()) {
      const a = geo.attributes[name].array, u = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
      for (let i = 0; i < u.length; i++) mix(u[i]);
      n += u.length;
    }
    if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) mix(ix[i]); }
    for (const g of geo.groups) { mix(g.start); mix(g.count); mix(g.materialIndex); }
    return h + ':' + n;
  }
  function split(geo) {
    if (parts.has(geo.uuid)) return parts.get(geo.uuid);
    const ck = contentKey(geo);
    if (byContent.has(ck)) { const shared = byContent.get(ck); parts.set(geo.uuid, shared); return shared; }
    const names = Object.keys(geo.attributes).sort();
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }];
    const out = groups.map((g) => {
      const sub = new THREE.BufferGeometry();
      if (geo.index) {
        const idx = geo.index.array.slice(g.start, g.start + g.count);
        for (const n of names) sub.setAttribute(n, geo.attributes[n]);
        sub.setIndex(new THREE.BufferAttribute(idx, 1));
        return { materialIndex: g.materialIndex, geometry: compact(sub), sig: names.join(',') };
      }
      for (const n of names) {
        const a = geo.attributes[n];
        sub.setAttribute(n, new THREE.BufferAttribute(a.array.slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize), a.itemSize, a.normalized));
      }
      return { materialIndex: g.materialIndex, geometry: weld(sub), sig: names.join(',') };
    });
    parts.set(geo.uuid, out); byContent.set(ck, out);
    return out;
  }
  // ExtrudeGeometry is non-indexed: every triangle carries its own three
  // vertices, so the GPU transformed ~14M vertices a frame. Welding identical
  // vertices (same position, normal and uv, bit for bit) into an index changes
  // nothing on screen and lets the vertex cache reuse shared corners.
  function weld(sub) {
    const names = Object.keys(sub.attributes), attrs = names.map((n) => sub.attributes[n]);
    const count = sub.attributes.position.count, map = new Map(), index = new Uint32Array(count), keep = [];
    for (let i = 0; i < count; i++) {
      let key = '';
      for (const a of attrs) for (let k = 0; k < a.itemSize; k++) key += a.array[i * a.itemSize + k] + ',';
      let j = map.get(key);
      if (j === undefined) { j = keep.length; map.set(key, j); keep.push(i); }
      index[i] = j;
    }
    const out = new THREE.BufferGeometry();
    names.forEach((n, ai) => {
      const a = attrs[ai], arr = new a.array.constructor(keep.length * a.itemSize);
      keep.forEach((src, dst) => { for (let k = 0; k < a.itemSize; k++) arr[dst * a.itemSize + k] = a.array[src * a.itemSize + k]; });
      out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    });
    out.setIndex(new THREE.BufferAttribute(index, 1));
    return out;
  }
  // An indexed group keeps only the vertices it references.
  function compact(sub) {
    const idx = sub.index.array, map = new Map(), order = [];
    for (const i of idx) if (!map.has(i)) { map.set(i, order.length); order.push(i); }
    const out = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(sub.attributes)) {
      const arr = new a.array.constructor(order.length * a.itemSize);
      order.forEach((src, dst) => { for (let k = 0; k < a.itemSize; k++) arr[dst * a.itemSize + k] = a.array[src * a.itemSize + k]; });
      out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    out.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx, (i) => map.get(i)), 1));
    return out;
  }

  // Bucket (material + attribute signature) -> instances.
  const buckets = new Map();
  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const part of split(mesh.geometry)) {
      const material = mats[part.materialIndex] ?? mats[0];
      if (!material || !part.geometry.attributes.position.count) continue;
      const key = material.uuid + '|' + part.sig + '|' + (part.geometry.index ? 'i' : 'n');
      let b = buckets.get(key);
      if (!b) buckets.set(key, b = { material, items: [] });
      b.items.push({ mesh, geometry: part.geometry });
    }
  }

  // One InstancedMesh per (material, sub-geometry): true GPU instancing, one
  // draw call for every copy of the same card. (BatchedMesh's multi-draw is
  // emulated draw-by-draw by ANGLE on Metal: ~98k driver draws a frame.)
  const batches = [], batchedMeshes = new Set();
  for (const b of buckets.values()) {
    const owners = new Set(b.items.map((i) => i.mesh));
    // V2 shares edge inks across every building family. Count once per bucket:
    // rebuilding this Set for every card below made startup quadratic (~14 s).
    b.ownerCount = owners.size;
    if (owners.size < minInstances) continue;
    const byGeo = new Map();
    for (const it of b.items) { let a = byGeo.get(it.geometry); if (!a) byGeo.set(it.geometry, a = []); a.push(it); }
    for (const [geometry, items] of byGeo) {
      const im = new THREE.InstancedMesh(geometry, b.material, items.length);
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const links = items.map(({ mesh }, id) => { im.setMatrixAt(id, mesh.matrixWorld); return { id, mesh }; });
      scene.add(im);
      batches.push({ bm: im, links });
    }
    for (const { mesh } of b.items) batchedMeshes.add(mesh);
  }

  // A mesh is hidden only when ALL its groups were batched; otherwise it keeps
  // drawing its remaining groups (rare: unique edge + shared print).
  const hidden = [];
  for (const mesh of batchedMeshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const all = split(mesh.geometry).every((p) => {
      const m = mats[p.materialIndex] ?? mats[0];
      const key = m.uuid + '|' + p.sig + '|' + (p.geometry.index ? 'i' : 'n');
      const bk = buckets.get(key);
      return bk && bk.ownerCount >= minInstances;
    });
    if (all) { mesh.userData.batchedVisible = mesh.visible; mesh.visible = false; hidden.push(mesh); }
    else {
      // draw only the groups that were not batched
      mesh.userData.batchedPartial = true;
    }
  }
  // Hide whole hinge groups whose every mesh is drawn instanced: the renderer
  // then skips their subtree instead of visiting ~100k hidden nodes a frame
  // (~10 ms of CPU). updateMatrixWorld and raycasts ignore visibility, so
  // motion, instance sync and tap-to-fold keep working.
  const hiddenSet = new Set(hidden);
  let hiddenGroups = 0;
  for (const h of H.hinges) {
    let all = true, any = false;
    h.group.traverse((o) => { if (o.isMesh) { any = true; if (!hiddenSet.has(o)) all = false; } });
    if (any && all) { h.group.visible = false; hiddenGroups++; }
  }
  // Partially batched meshes: replace the batched groups' materials by an
  // invisible placeholder so they are not drawn twice.
  const skip = new THREE.MeshBasicMaterial({ visible: false });
  for (const mesh of batchedMeshes) {
    if (!mesh.userData.batchedPartial || !Array.isArray(mesh.material)) continue;
    mesh.material = mesh.material.map((m) => {
      const used = batches.some((b) => b.bm.material === m && b.links.some((l) => l.mesh === mesh));
      return used ? skip : m;
    });
  }

  function visibleChain(o) {
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  // Each instance follows its nearest hinge. A settled hinge without wind sway
  // cannot move its cards, so its instances are copied once and then skipped.
  const hingeOf = new Map(H.hinges.map((h) => [h.group, h]));
  for (const b of batches) for (const l of b.links) {
    for (let o = l.mesh; o; o = o.parent) { const h = hingeOf.get(o); if (h) { l.hinge = h; break; } }
  }
  // Moving = the spring is actually animating (a piece still waiting for its turn
  // in the rise wave is pending but still, and must not cost anything).
  const moving = (h) => !h || !h.spring.atRest || h.swayAmp || h.thaw > 0 || h.sway || h.p !== h.syncedP;
  let full = 2;
  // Index instances by hinge so a frame only visits the hinges that move
  // (scanning all ~109k instances every frame cost ~7 ms during the rise).
  const byHinge = new Map(), loose = [];
  batches.forEach((b, bi) => { for (const l of b.links) { if (l.hinge) { let a = byHinge.get(l.hinge); if (!a) byHinge.set(l.hinge, a = []); a.push([bi, l]); } else loose.push([bi, l]); } });
  const hingeList = [...byHinge.keys()];
  const lo = new Int32Array(batches.length), hi = new Int32Array(batches.length);
  function write(bi, l) {
    const a = batches[bi].bm.instanceMatrix.array, e = l.mesh.matrixWorld.elements, o = l.id * 16;
    // element by element: TypedArray.set() from a plain Array converts on every call
    a[o] = e[0]; a[o + 1] = e[1]; a[o + 2] = e[2]; a[o + 3] = e[3]; a[o + 4] = e[4]; a[o + 5] = e[5]; a[o + 6] = e[6]; a[o + 7] = e[7];
    a[o + 8] = e[8]; a[o + 9] = e[9]; a[o + 10] = e[10]; a[o + 11] = e[11]; a[o + 12] = e[12]; a[o + 13] = e[13]; a[o + 14] = e[14]; a[o + 15] = e[15];
    if (l.id < lo[bi]) lo[bi] = l.id;
    if (l.id > hi[bi]) hi[bi] = l.id;
  }
  function sync(force = false) {
    const all = force || full > 0; if (full > 0) full--;
    lo.fill(2147483647); hi.fill(-1);
    for (const h of hingeList) {
      if (!all && !moving(h)) continue;
      // reset() can jump while the real-time loop is paused. Its subtree may
      // still be frozen because no onStep ran between reset and this render.
      if(h.frozen&&h.p!==h.syncedP){
        delete h.group.updateMatrixWorld;h.frozen=false;h.thaw=2;
        h.group.updateMatrixWorld(true);
      }
      for (const [bi, l] of byHinge.get(h)) write(bi, l);
      h.syncedP = h.p;
    }
    if (all) for (const [bi, l] of loose) write(bi, l);
    batches.forEach(({ bm }, bi) => {
      if (hi[bi] < 0) return;
      const attr = bm.instanceMatrix;
      attr.clearUpdateRanges(); attr.addUpdateRange(lo[bi] * 16, (hi[bi] - lo[bi] + 1) * 16); attr.needsUpdate = true;
    });
  }
  function syncVisibility() {}   // instanced copies are always visible (none of the batched pieces hide)
  syncVisibility();
  // Scene.onBeforeRender runs after graph updates but BEFORE WebGLObjects
  // uploads instance attributes. Mesh.onBeforeRender was too late: the GPU
  // kept the previous pose for one frame (forever in a paused capture).
  const beforeRender=scene.onBeforeRender;
  scene.onBeforeRender=function(...args){beforeRender?.apply(this,args);sync();};
  // Freeze settled hinges: a hinge that neither folds nor sways cannot move its
  // subtree, so its group skips updateMatrixWorld (~25k objects a frame; three
  // r187 recurses children even with matrixWorldAutoUpdate off). It thaws the
  // moment it moves again (fold, replay) and stays live two frames after.
  // Hinges holding other hinges are never frozen.
  const hingeGroups = new Set(H.hinges.map((h) => h.group));
  const NOOP = () => {};
  const statics = H.hinges.filter((h) => {
    let nested = false;
    h.group.traverse((o) => { if (o !== h.group && hingeGroups.has(o)) nested = true; });
    return !nested;
  });
  // Wind sway only where it can be seen: trees within a radius of the camera
  // target in close shots, none in wide shots. 3.3k swaying trees recomputed
  // and re-uploaded every frame cost ~80 ms; far sway is sub-pixel and blurred.
  const swayers = H.hinges.filter((h) => h.swayAmp);
  for (const h of swayers) h.swayAmp0 = h.swayAmp;
  let swayTick = 0;
  // Trees fade in and out of the wind over ~1 s: switching sway on or off at
  // once made trees crossing the radius snap while the camera panned (flicker).
  function swayLOD() {
    const d = H.view.dist, r = d < 60 ? 22 : 0, tx = H.target.x, tz = H.target.z;
    for (const h of swayers) {
      const near = r > 0 && Math.abs(h.x - tx) < r && Math.abs(h.z - tz) < r * 1.4;
      h.swayTarget = near ? h.swayAmp0 : 0;
    }
  }
  H.onStep((t, dt) => {
    if ((swayTick++ % 15) === 0) swayLOD();
    const k = Math.min(1, dt * 1.6);
    for (const h of swayers) {
      const target = h.swayTarget ?? 0;
      if (h.swayAmp === target) continue;
      h.swayAmp += (target - h.swayAmp) * k;
      if (Math.abs(h.swayAmp - target) < 1e-3) h.swayAmp = target;
      if (!h.swayAmp) h.sway = 0;
    }
    for (const h of statics) {
      // moving, or jumped (reset/replay set p without animating)
      if (!h.spring.atRest || h.swayAmp || h.p !== h.lastP) h.thaw = 2;
      h.lastP = h.p;
      if (h.thaw > 0) { h.thaw--; if (h.frozen) { delete h.group.updateMatrixWorld; h.frozen = false; } }
      else if (!h.frozen) { h.group.updateMatrixWorld(true); h.group.updateMatrixWorld = NOOP; h.frozen = true; }
    }
  });
  const stats = { meshes: meshes.length, hidden: hidden.length, hiddenGroups, drawCalls: batches.length, instances: batches.reduce((s, b) => s + b.links.length, 0) };
  console.info('[batcher]', stats);
  return { stats, sync, syncVisibility, batches };
}
