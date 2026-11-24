/**
 * Shadows on demand.
 *
 * The harness re-centred the key's shadow box on the camera target every frame,
 * so the shadow map was redrawn every frame: ~23 ms for the whole batched town.
 * Here the box is fixed over the mapped town at a higher resolution (same texel
 * size as the old moving box) and redrawn only while pieces fold or unfold
 * (every frame) and for a few frames after they settle. Wind sway (a
 * degree or two) is not re-shadowed; in a soft penumbra it is invisible.
 */
export function fixShadows(H, { center = [0, -45], half = 95, mapSize = 4096 } = {}) {
  const R = H.renderer;
  let key = null;
  H.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) key = o; });
  if (!key) return null;
  H.fixedShadow = true;
  const dir = key.position.clone().sub(key.target.position).normalize();
  const dist = 160;
  key.target.position.set(center[0], 0, center[1]); key.target.updateMatrixWorld();
  key.position.copy(key.target.position).addScaledVector(dir, dist);
  const cam = key.shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.near = 1; cam.far = dist + half * 2;
  cam.updateProjectionMatrix();
  if (key.shadow.mapSize.x !== mapSize) {
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.map?.dispose(); key.shadow.map = null;
  }
  R.shadowMap.autoUpdate = false;
  R.shadowMap.needsUpdate = true;
  let settled = 0;
  let lastSum = NaN;
  const moving = () => {
    let sum = 0; for (const h of H.hinges) sum += h.p;   // also catches jumps (reset) that do not animate
    const jumped = sum !== lastSum; lastSum = sum;
    return jumped || H.hinges.some((h) => h.pending || Math.abs(h.p - h.open) > 1e-4);
  };
  H.onStep(() => {
    if (moving()) {
      settled = 0;
      // every frame while anything moves: updating every 3rd frame made moving
      // shadows step (visible flicker on tap-fold); with instancing the pass is cheap
      R.shadowMap.needsUpdate = true;
    } else if (settled < 3) {
      settled++;
      R.shadowMap.needsUpdate = true;
    }
  });
  return { key, refresh() { R.shadowMap.needsUpdate = true; } };
}
