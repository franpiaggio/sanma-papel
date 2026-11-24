/**
 * Draw-call batching for the paper town.
 *
 * Every card is its own mesh with up to three material groups (front print,
 * cut edge, back), so a wide shot issued 20k+ draw calls and the opening ran at
 * ~6 fps. Infill houses come from five master models and trees from shared
 * plates, so most cards share their materials. Here every (material, group)
 * that recurs is moved into one THREE.BatchedMesh: one draw call per material,
 * drawn whole (per-instance CPU culling cost more than it saved).
 *
 * Motion is preserved exactly: the original meshes stay in the scene graph
 * (hidden), the harness keeps animating their hinges, sway and follow() links,
 * and every frame each instance copies its source mesh's world matrix. Fold,
 * replay and wind therefore look identical; only the draw path changes.
 * Batches cast and receive shadows, so the shadow pass is batched as well.
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
  function split(geo) {
    if (parts.has(geo.uuid)) return parts.get(geo.uuid);
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
      return { materialIndex: g.materialIndex, geometry: sub, sig: names.join(',') };
    });
    parts.set(geo.uuid, out);
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

  const batches = [], batchedMeshes = new Set();
  for (const b of buckets.values()) {
    const owners = new Set(b.items.map((i) => i.mesh));
    if (owners.size < minInstances) continue;
    const geos = [...new Set(b.items.map((i) => i.geometry))];
    const verts = geos.reduce((s, g) => s + g.attributes.position.count, 0);
    const indexed = !!geos[0].index;
    const idx = indexed ? geos.reduce((s, g) => s + g.index.count, 0) : 0;
    const bm = new THREE.BatchedMesh(b.items.length, verts, idx || undefined, b.material);
    bm.castShadow = true; bm.receiveShadow = true;
    // Per-instance CPU culling of ~60k instances (main + shadow pass) cost
    // ~20 ms a frame; the GPU draws the whole town faster than that.
    bm.sortObjects = false; bm.perObjectFrustumCulled = false;
    bm.frustumCulled = false;
    const gid = new Map(geos.map((g) => [g, bm.addGeometry(g)]));
    const links = b.items.map(({ mesh, geometry }) => {
      const id = bm.addInstance(gid.get(geometry));
      bm.setMatrixAt(id, mesh.matrixWorld);
      return { id, mesh };
    });
    scene.add(bm);
    batches.push({ bm, links });
    for (const { mesh } of links) batchedMeshes.add(mesh);
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
  const moving = (h) => !h || h.pending || h.swayAmp || Math.abs(h.p - h.open) > 1e-4 || h.sway || h.p !== h.syncedP;
  let frame = -1, full = 2;
  function sync(force = false) {
    const all = force || full > 0; if (full > 0) full--;
    const state = new Map();
    // Write straight into each batch's matrix texture (setMatrixAt validates
    // and flags per call; ~80k calls a frame while the town folds).
    for (const { bm, links } of batches) {
      const data = bm._matricesTexture.image.data;
      let dirty = false;
      for (const l of links) {
        const h = l.hinge;
        let m = state.get(h); if (m === undefined) { m = moving(h); state.set(h, m); }
        if (!all && !m && l.settled) continue;
        data.set(l.mesh.matrixWorld.elements, l.id * 16);
        l.settled = !m; dirty = true;
        if (h) h.syncedP = h.p;
      }
      if (dirty) bm._matricesTexture.needsUpdate = true;
    }
  }
  function syncVisibility() {
    for (const { bm, links } of batches) for (const { id, mesh } of links) {
      const v = (mesh.visible || mesh.userData.batchedVisible !== false) && visibleChain(mesh);
      bm.setVisibleAt(id, v);
    }
  }
  syncVisibility();
  // Copy matrices once per rendered frame, after the renderer updated the graph.
  for (const { bm } of batches) {
    // BatchedMesh culls its instances in its own onBeforeRender/onBeforeShadow:
    // wrap them, never replace them.
    const before = bm.onBeforeRender.bind(bm), shadow = bm.onBeforeShadow?.bind(bm);
    const once = (renderer) => { const f = renderer.info.render.frame; if (f !== frame) { frame = f; sync(); } };
    bm.onBeforeRender = (renderer, ...rest) => { once(renderer); before(renderer, ...rest); };
    if (shadow) bm.onBeforeShadow = (renderer, ...rest) => { once(renderer); shadow(renderer, ...rest); };
  }
  // Freeze settled hinges: a hinge that neither folds nor sways cannot move its
  // subtree, so its group skips updateMatrixWorld (~25k objects a frame; three
  // r187 recurses children even with matrixWorldAutoUpdate off). It thaws the
  // moment it moves again (fold, replay) and stays live two frames after.
  // Hinges holding other hinges are never frozen.
  const hingeGroups = new Set(H.hinges.map((h) => h.group));
  const NOOP = () => {};
  const statics = H.hinges.filter((h) => {
    if (h.swayAmp) return false;
    let nested = false;
    h.group.traverse((o) => { if (o !== h.group && hingeGroups.has(o)) nested = true; });
    return !nested;
  });
  H.onStep(() => {
    for (const h of statics) {
      // moving, or jumped (reset/replay set p without animating)
      if (h.pending || Math.abs(h.p - h.open) > 1e-4 || h.p !== h.lastP) h.thaw = 2;
      h.lastP = h.p;
      if (h.thaw > 0) { h.thaw--; if (h.frozen) { delete h.group.updateMatrixWorld; h.frozen = false; } }
      else if (!h.frozen) { h.group.updateMatrixWorld(true); h.group.updateMatrixWorld = NOOP; h.frozen = true; }
    }
  });
  // Close shots see a small part of the town: per-instance culling then saves
  // more GPU time than its CPU cost. Wide shots see everything: draw whole.
  let culling = null;
  H.onStep(() => {
    const want = H.view.dist < 35;
    if (want !== culling) {
      culling = want;
      // Turning culling off must rebuild the draw list: BatchedMesh skips the
      // rebuild when culling is off and nothing changed, so it kept drawing
      // only what the last close-up frustum saw (the town vanished on zoom out).
      for (const { bm } of batches) { bm.perObjectFrustumCulled = want; bm._visibilityChanged = true; }
    }
  });
  const stats = { meshes: meshes.length, hidden: hidden.length, batches: batches.length, instances: batches.reduce((s, b) => s + b.links.length, 0) };
  console.info('[batcher]', stats);
  return { stats, sync, syncVisibility, batches };
}
