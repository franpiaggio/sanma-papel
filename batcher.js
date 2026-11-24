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
      return bk && new Set(bk.items.map((i) => i.mesh)).size >= minInstances;
    });
    if (all) { mesh.userData.batchedVisible = mesh.visible; mesh.visible = false; hidden.push(mesh); }
    else {
      // draw only the groups that were not batched
      mesh.userData.batchedPartial = true;
    }
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
  const moving = (h) => !h || h.pending || h.swayAmp || h.thaw > 0 || Math.abs(h.p - h.open) > 1e-4 || h.sway || h.p !== h.syncedP;
  let frame = -1, full = 2;
  function sync(force = false) {
    const all = force || full > 0; if (full > 0) full--;
    const state = new Map();
    // Write straight into each batch's matrix texture (setMatrixAt validates
    // and flags per call; ~80k calls a frame while the town folds).
    for (const { bm, links } of batches) {
      const data = bm.instanceMatrix.array;
      let dirty = false;
      for (const l of links) {
        const h = l.hinge;
        let m = state.get(h); if (m === undefined) { m = moving(h); state.set(h, m); }
        if (!all && !m && l.settled) continue;
        data.set(l.mesh.matrixWorld.elements, l.id * 16);
        l.settled = !m; dirty = true;
        if (h) h.syncedP = h.p;
      }
      if (dirty) bm.instanceMatrix.needsUpdate = true;
    }
  }
  function syncVisibility() {}   // instanced copies are always visible (none of the batched pieces hide)
  syncVisibility();
  // Copy matrices once per rendered frame, after the renderer updated the graph.
  for (const { bm } of batches) {
    bm.onBeforeRender = (renderer) => { const f = renderer.info.render.frame; if (f !== frame) { frame = f; sync(); } };
    bm.onBeforeShadow = (renderer) => { const f = renderer.info.render.frame; if (f !== frame) { frame = f; sync(); } };
  }
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
  function swayLOD() {
    const d = H.view.dist, r = d < 60 ? 22 : 0, tx = H.target.x, tz = H.target.z;
    for (const h of swayers) {
      const near = r > 0 && Math.abs(h.x - tx) < r && Math.abs(h.z - tz) < r * 1.4;
      h.swayAmp = near ? h.swayAmp0 : 0;
      if (!near) h.sway = 0;
    }
  }
  H.onStep(() => {
    if ((swayTick++ % 15) === 0) swayLOD();
    for (const h of statics) {
      // moving, or jumped (reset/replay set p without animating)
      if (h.pending || h.swayAmp || Math.abs(h.p - h.open) > 1e-4 || h.p !== h.lastP) h.thaw = 2;
      h.lastP = h.p;
      if (h.thaw > 0) { h.thaw--; if (h.frozen) { delete h.group.updateMatrixWorld; h.frozen = false; } }
      else if (!h.frozen) { h.group.updateMatrixWorld(true); h.group.updateMatrixWorld = NOOP; h.frozen = true; }
    }
  });
  const stats = { meshes: meshes.length, hidden: hidden.length, drawCalls: batches.length, instances: batches.reduce((s, b) => s + b.links.length, 0) };
  console.info('[batcher]', stats);
  return { stats, sync, syncVisibility, batches };
}
