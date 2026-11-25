/** Lake → Avenida San Martín → Plaza San Martín, on the mapped paper city.
 * The fixed Papercraft harness owns the render clock; no second animation loop.
 */
export const TOUR_DURATION = 22;
// Social clip (X/Twitter, 16:9): a framed opening over the town and the lake
// arm (never wide enough to show the unprinted page edges), a zoom in while
// the town rises from the page, then a short glide through the streets to
// Plaza San Martín. Points are mapped (.06 units/m): pier (0,0), terminal
// (-.4,-8.9), Plaza del Centenario (-9.8,-19.7), Intendencia (-1.8,-40.3),
// Plaza San Martín (-.2,-44.8).
export const CINEMATIC_ROUTE = Object.freeze([
  { t: 0, x: 4, z: -40, dist: 126, yaw: -22, pitch: 29, y: .45 },   // the valley: lake, town, ridges on both sides and at the far end
  { t: 2.2, x: 4, z: -37, dist: 120, yaw: -22, pitch: 29.5, y: .45 },
  { t: 6.5, x: -2, z: -10, dist: 46, yaw: -22, pitch: 33, y: .45 },
  { t: 10, x: -6, z: -5, dist: 28, yaw: -23, pitch: 32, y: .45 },
  { t: 14, x: -7, z: -18, dist: 22, yaw: -20, pitch: 33, y: .45 },
  { t: 18, x: -2, z: -36, dist: 18, yaw: -14, pitch: 34, y: .45 },
  { t: 22, x: -.5, z: -44, dist: 15, yaw: -9, pitch: 34, y: .45 },
].map(Object.freeze));

// The town rises from the page during the opening zoom (restart unfolds it);
// no extra fold events in this cut.
export const TOUR_EVENTS = Object.freeze([]);

const values = ['x', 'z', 'dist', 'yaw', 'pitch', 'y'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Cubic Hermite slopes use time, preserving velocity through each waypoint.
// Each interpolated component stays within its segment's endpoints: the lens
// cannot overshoot through a nearby roof or beyond the mapped town.
export function routeAt(seconds) {
  const t = clamp(Number.isFinite(seconds) ? seconds : 0, 0, TOUR_DURATION);
  let i = 0;
  while (i < CINEMATIC_ROUTE.length - 2 && t > CINEMATIC_ROUTE[i + 1].t) i++;
  const a = CINEMATIC_ROUTE[i], b = CINEMATIC_ROUTE[i + 1];
  const before = CINEMATIC_ROUTE[Math.max(0, i - 1)];
  const after = CINEMATIC_ROUTE[Math.min(CINEMATIC_ROUTE.length - 1, i + 2)];
  const span = b.t - a.t, u = (t - a.t) / span;
  const h00 = 2*u*u*u - 3*u*u + 1, h10 = u*u*u - 2*u*u + u;
  const h01 = -2*u*u*u + 3*u*u, h11 = u*u*u - u*u;
  const out = { t };
  for (const key of values) {
    const m0 = i === 0 ? 0 : (b[key] - before[key]) / (b.t - before.t);
    const m1 = i + 1 === CINEMATIC_ROUTE.length - 1 ? 0 : (after[key] - a[key]) / (after.t - a.t);
    out[key] = clamp(h00*a[key] + h10*span*m0 + h01*b[key] + h11*span*m1,
      Math.min(a[key], b[key]), Math.max(a[key], b[key]));
  }
  return out;
}

export function createCinematicTour(H, { reducedMotion = false, introDuration = .5, autoplay = true } = {}) {
  let elapsed = 0, intro = 0, running = false, disposed = false, drag = null;
  const canvas = H.renderer.domElement;
  const api = () => window.__papercraft;
  const announce = () => window.dispatchEvent(new CustomEvent('sanmartin-tour', {
    detail: { running, progress: elapsed / TOUR_DURATION, seconds: elapsed },
  }));
  function apply(view) {
    // A portrait frame (Reels) sees more depth: its wide shots look a little
    // steeper and from further back, so the page edge stays out of frame and
    // the valley ring stays in; close shots are unchanged.
    if ((H.frame?.aspect ?? 16 / 9) < 1) {
      const k = clamp((view.dist - 40) / 80, 0, 1);
      view = { ...view, pitch: view.pitch + 8 * k, dist: view.dist * (1 + .17 * k), z: view.z - 4 * k };
    }
    H.view.yaw = H.view.tyaw = view.yaw;
    H.view.pitch = H.view.tpitch = view.pitch;
    api()?.look(view.x, view.z, view.dist, view.y);
  }
  function seek(seconds) {
    intro = introDuration;
    elapsed = clamp(Number.isFinite(seconds) ? seconds : 0, 0, TOUR_DURATION);
    apply(routeAt(elapsed));
    announce();
    return elapsed;
  }
  function play() {
    if (disposed) return;
    if (elapsed >= TOUR_DURATION) elapsed = 0;
    running = true;
    apply(routeAt(elapsed));
    api()?.resume();
    const pause = document.getElementById('pause');
    pause?.setAttribute('aria-pressed', 'false');
    announce();
  }
  function pause() { running = false; announce(); }
  // The town rises in one wave from the shore inward while the camera zooms
  // in: every piece starts flat, the lakefront first, the far barrios last
  // (~6 s), so the rise is seen from the opening framing.
  // The mountains rise first (back to front within each ridge), then the town
  // in a wave from the shore inward. Springs are softened for this: close to
  // critical damping, so pieces settle with a slight give, not a hard bounce.
  function soften(s, k = .42) {
    if (s.soft) return;
    s.kUp *= k; s.cUp = 1.85 * Math.sqrt(s.kUp);   // ~0.9 of critical damping
    s.zL = Math.max(s.zL, .32); s.dragL *= 1.6;      // the latch quiver dies quickly
    s.soft = true;
  }
  function rise() {
    for (const h of H.hinges) {
      h.reset(0);
      soften(h.spring, h.hill ? .12 : .6);    // ridges rise slowly (~1.5 s); houses and trees in ~0.8 s, so fewer pieces are in the air at once
      const z = Number.isFinite(h.z) ? h.z : 0;
      const delay = h.hill ? .15 + (2 - (h.layer || 0)) * .18 + (h.jit || 0)
        : 1.1 + Math.max(0, -z) * .034 + (h.jit || 0);   // spread so fewer pieces are in the air at once
      h.set(1, delay);
    }
  }
  function restart() { elapsed = 0; intro = 0; rise(); play(); }
  function stop() { running = false; announce(); }
  H.onStep((time, dt) => {
    if (disposed || !running || dt <= 0) return;
    if (intro < introDuration) { intro += dt; apply(routeAt(0)); return; }
    const before = elapsed;
    elapsed = Math.min(TOUR_DURATION, elapsed + dt);
    for (const e of TOUR_EVENTS) if (before < e.t && elapsed >= e.t) api()?.setOpen?.(e.open);
    apply(routeAt(elapsed));
    if (elapsed === TOUR_DURATION) { running = false; announce(); }
  });

  // A drag takes over the shot. Capture prevents the harness's old ±12° orbit
  // limit (and tap-to-fold gesture) from pulling the new view back on release.
  canvas.style.touchAction = 'none';
  // A drag takes over the shot; a click (no drag) is a tap on the paper and is
  // re-dispatched as 'papercraft-tap' for interact.js. The tour keeps playing
  // through taps.
  function down(event) {
    if (event.button !== 0 || disposed || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, moved: false, t0: performance.now() };
    canvas.setPointerCapture?.(event.pointerId);
    event.stopImmediatePropagation();
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > 6) { drag.moved = true; stop(); }
    if (!drag.moved) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    H.view.tyaw = clamp(H.view.tyaw - dx*.16, -45, 35);
    H.view.tpitch = clamp(H.view.tpitch + dy*.12, 28, 58);
    event.stopImmediatePropagation();
  }
  function up(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const tap = !drag.moved && performance.now() - drag.t0 < 350;   // a short, deliberate click
    drag = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    event.stopImmediatePropagation();
    if (tap) window.dispatchEvent(new CustomEvent('papercraft-tap', { detail: { x: event.clientX, y: event.clientY } }));
  }
  function wheel(event) {
    stop();
    // Keep the close framing above the harness's five-unit near plane and the
    // widest framing inside the dressed town, rather than its sparse map edge.
    const dist = clamp(H.view.dist * Math.exp(event.deltaY*.001), 12, 130);
    api()?.look(H.target.x, H.target.z, dist, H.target.y);
    event.preventDefault();
  }
  // WASD / arrows pan the camera over the page, relative to where it looks;
  // Shift moves faster. Any key stops the guided tour.
  const keys = new Set(), KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  function keydown(event) {
    if (!KEYS[event.code] || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA/.test(event.target?.tagName)) return;
    if (running) stop();
    keys.add(event.code); event.preventDefault();
  }
  function keyup(event) { keys.delete(event.code); }
  function clearKeys() { keys.clear(); }
  H.onStep((time, dt) => {
    if (disposed || !keys.size || dt <= 0) return;
    let mx = 0, mz = 0;
    for (const k of keys) { mx += KEYS[k][0]; mz += KEYS[k][1]; }
    if (!mx && !mz) return;
    const fwd = new H.THREE.Vector3(); H.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new H.THREE.Vector3(-fwd.z, 0, fwd.x);
    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') || shift ? 2.2 : 1;
    const speed = Math.max(6, H.view.dist * .55) * fast * dt / Math.hypot(mx, mz);
    const x = clamp(H.target.x + (right.x * mx + fwd.x * mz) * speed, -110, 110);
    const z = clamp(H.target.z + (right.z * mx + fwd.z * mz) * speed, -175, 50);
    api()?.look(x, z, H.view.dist, H.target.y);
  });
  let shift = false;
  const shiftTrack = (e) => { shift = e.shiftKey; };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('keydown', shiftTrack);
  window.addEventListener('keyup', shiftTrack);
  window.addEventListener('blur', clearKeys);
  canvas.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  canvas.addEventListener('wheel', wheel, { passive: false });
  function dispose() {
    disposed = true; running = false;
    canvas.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    canvas.removeEventListener('wheel', wheel);
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
    window.removeEventListener('keydown', shiftTrack); window.removeEventListener('keyup', shiftTrack);
    window.removeEventListener('blur', clearKeys);
  }
  apply(routeAt(0));
  if (!reducedMotion && autoplay) restart();
  return { play, pause, stop, restart, seek, dispose,
    get running() { return running; },
    get progress() { return elapsed / TOUR_DURATION; },
    get seconds() { return elapsed; },
    duration: TOUR_DURATION,
  };
}
