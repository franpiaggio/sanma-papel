/**
 * Tap to fold: a click on the paper folds the piece under it and its
 * neighbours flat in a short ripple, then they rise again. A tap on a ridge
 * folds that ridge only. Taps arrive as 'papercraft-tap' from the tour's
 * pointer handler (a drag still orbits the camera).
 *
 * The original card meshes are hidden (they draw through BatchedMesh) but
 * stay in the scene graph with current matrices, so a raycast against them
 * finds exactly what the viewer sees.
 */
export function createTapFold(H, { radius = 3.5, hold = 1.4, spread = 0.04 } = {}) {
  const THREE = H.THREE, camera = H.camera, canvas = H.renderer.domElement;
  const ray = new THREE.Raycaster();
  const hingeOf = new Map(H.hinges.map((h) => [h.group, h]));
  const pending = [];   // { at, hinge } rises scheduled on the harness clock
  let clock = 0;

  // Only the pieces (not the ground sheet, water or sky) are candidates.
  const pieces = [];
  for (const h of H.hinges) pieces.push(h.group);

  function hingeFor(object) {
    for (let o = object; o; o = o.parent) { const h = hingeOf.get(o); if (h) return h; }
    return null;
  }

  function tap({ x, y }) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pieces, true)[0];
    if (!hit) return;
    const center = hingeFor(hit.object);
    if (!center) return;
    const group = center.hill
      ? H.hinges.filter((h) => h.hill && Math.hypot(h.x - center.x, h.z - center.z) < 3)   // one ridge, its three layers
      : H.hinges.filter((h) => !h.hill && Number.isFinite(h.x) && Math.hypot(h.x - hit.point.x, h.z - hit.point.z) < radius);
    if (!group.includes(center)) group.push(center);
    for (const h of group) {
      const d = Math.hypot(h.x - hit.point.x, h.z - hit.point.z);
      h.set(0, d * spread);                                   // ripple outward from the tap
      pending.push({ at: clock + hold + d * spread * 1.5, hinge: h });
    }
  }

  H.onStep((t, dt) => {
    clock += dt;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].at <= clock) { pending[i].hinge.set(1, 0); pending.splice(i, 1); }
    }
  });
  window.addEventListener('papercraft-tap', (e) => tap(e.detail));
  return { tap };
}
