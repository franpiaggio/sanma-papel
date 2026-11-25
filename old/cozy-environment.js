/** A detailed paper ground and bounded camera presets for the mapped city.
 *
 * Integration before H.start():
 *   const cozy = applyCozyEnvironment(H);
 *   H.start();
 *   cozy.setView('city');
 *
 * Also use COZY_VIEW when creating H, so the harness's responsive framing and
 * restart snapshot inherit the same authored view. No harness changes needed.
 */
import { paperMaterial } from 'papercraft/lib/paperkit-3d.js';
import { CINEMATIC_ROUTE } from './cinematic-route.js';

const { t: openingTime, ...openingView } = CINEMATIC_ROUTE[0];
export const COZY_VIEW = Object.freeze(openingView);

export const COZY_VIEWS = Object.freeze({
  city: COZY_VIEW,
  lake: Object.freeze({ x: -1, z: -3, dist: 29, y: .4, yaw: -22, pitch: 32 }),
  square: Object.freeze({ x: -.16752506, z: -45, dist: 14.5, y: .45, yaw: -8, pitch: 33 }),
});

export const DETAIL_GROUND_BOUNDS = Object.freeze({ x0: -45, x1: 45, z0: -90, z1: 25 });
const DEFAULT_TEXTURE = new URL('./media/detail-ground.png', import.meta.url).href;
const INSTANCES = new WeakMap();

/**
 * Returns {sheet, ready, views, setView, setAngles, dispose}.
 * ready resolves to the loaded sheet, or null if loading fails; the existing
 * printed ground remains visible until the detailed plate has loaded.
 */
export function applyCozyEnvironment(H, { textureURL = DEFAULT_TEXTURE, initialView = 'city' } = {}) {
  if (INSTANCES.has(H)) return INSTANCES.get(H);
  const { THREE } = H;
  const B = DETAIL_GROUND_BOUNDS;
  let disposed = false;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const normalMap = H.paper?.normalMap?.clone() || null;
  if (normalMap) {
    normalMap.repeat.set((B.x1 - B.x0) / 5, (B.z1 - B.z0) / 5);
    normalMap.needsUpdate = true;
  }
  const material = paperMaterial({ color: '#ffffff', normalMap, normalScale: .35 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  const geometry = new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0);
  const sheet = new THREE.Mesh(geometry, material);
  sheet.name = 'Suelo de papel · costa y jardines';
  sheet.rotation.x = -Math.PI / 2;
  // Harness printGround sits at y=0 and its distant sheet at y=-0.02.
  // The popup hinge bases begin above y=0.02, so this plate does not lift them.
  sheet.position.set((B.x0 + B.x1) / 2, .003, (B.z0 + B.z1) / 2);
  sheet.receiveShadow = true;
  sheet.castShadow = false;
  sheet.renderOrder = 1;
  sheet.visible = false;
  sheet.userData.detailGround = true;
  H.scene.add(sheet);

  // textureURL: null skips the baked plate (the live printed ground shows).
  const texture = !textureURL ? (resolveReady(null), null) : new THREE.TextureLoader().load(textureURL, loaded => {
    if (disposed) {
      loaded.dispose();
      resolveReady(null);
      return;
    }
    material.map = loaded;
    material.needsUpdate = true;
    sheet.visible = true;
    resolveReady(sheet);
  }, undefined, error => {
    // A missing optional detail plate must not hide the original printed world.
    console.warn('No se pudo cargar el suelo detallado de papel.', error);
    resolveReady(null);
  });
  if (texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, H.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  material.map = texture;
  }

  function positionCamera() {
    const yaw = THREE.MathUtils.degToRad(H.view.yaw);
    const pitch = THREE.MathUtils.degToRad(H.view.pitch);
    const { dist } = H.view;
    H.camera.position.set(
      H.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      H.target.y + Math.sin(pitch) * dist,
      H.target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    H.camera.lookAt(H.target);
    H.camera.updateMatrixWorld();
  }

  function setAngles({ yaw = H.view.tyaw, pitch = H.view.tpitch } = {}, { immediate = true } = {}) {
    // Cinematic route owns orbit input; these bounds keep the whole shot above
    // the printed ground while allowing a readable oblique facade view.
    const nextYaw = THREE.MathUtils.clamp(Number.isFinite(yaw) ? yaw : COZY_VIEW.yaw, -45, 35);
    const nextPitch = THREE.MathUtils.clamp(Number.isFinite(pitch) ? pitch : COZY_VIEW.pitch, 28, 58);
    H.view.tyaw = nextYaw;
    H.view.tpitch = nextPitch;
    if (immediate) {
      H.view.yaw = nextYaw;
      H.view.pitch = nextPitch;
      positionCamera();
    }
    return { yaw: nextYaw, pitch: nextPitch };
  }

  function setView(preset = 'city', options = {}) {
    const requested = typeof preset === 'string' ? COZY_VIEWS[preset] : preset;
    if (!requested) return null;
    const view = { ...COZY_VIEW, ...requested };
    if (![view.x, view.z, view.dist, view.y].every(Number.isFinite) || view.dist <= 0) return null;
    setAngles(view, options);
    const live = globalThis.__papercraft;
    if (live?.scene === H.scene && typeof live.look === 'function') {
      // look() also focuses the lens and refits the kit's soft shadow map.
      live.look(view.x, view.z, view.dist, view.y);
    } else {
      H.view.dist = view.dist;
      H.target.set(view.x, view.y, view.z);
      positionCamera();
    }
    return { ...view, yaw: H.view.tyaw, pitch: H.view.tpitch };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    H.scene.remove(sheet);
    geometry.dispose();
    material.dispose();
    normalMap?.dispose();
    texture?.dispose();
    INSTANCES.delete(H);
    resolveReady(null);
  }

  const controls = { sheet, ready, views: COZY_VIEWS, setView, setAngles, dispose };
  INSTANCES.set(H, controls);
  if (initialView) setView(initialView);
  return controls;
}
