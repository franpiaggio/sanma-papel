/**
 * Deterministic video capture (?record).
 *
 * Open the page served with CAPTURE_DIR set (npm run record), e.g.
 *   http://localhost:4173/?size=1920x1080&capture&record
 * The page stops the real-time loop, replays the tour from t = 0 on a fixed
 * 30 fps clock and POSTs every frame as JPEG to /__capture/fNNNNN.jpg, which
 * the dev server writes into CAPTURE_DIR. Then run npm run encode.
 * Frame timing never depends on how fast this machine renders.
 */
export async function record({ fps = 30, hold = 1, quality = 0.95 } = {}) {
  const S = window.__sanMartin, api = window.__papercraft;
  const canvas = S.H.renderer.domElement;
  const total = Math.round((0.5 + S.tour.duration + hold) * fps);   // .5 s intro + the route + a held end
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;left:12px;top:12px;z-index:20;font:12px system-ui;padding:6px 10px;border-radius:6px;background:rgba(20,20,20,.75);color:#fff';
  document.body.append(badge);
  api.step(0);                 // stop the real-time loop
  S.tour.restart();            // pieces flat, rise choreography armed, route at t = 0
  for (let i = 0; i < total; i++) {
    api.step(1 / fps, 60);     // two 1/60 s physics substeps per frame, then render
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    const res = await fetch(`/__capture/f${String(i).padStart(5, '0')}.jpg`, { method: 'POST', body: blob });
    if (res.status !== 204) { badge.textContent = `Error ${res.status}: ¿el servidor tiene CAPTURE_DIR?`; throw new Error(`capture ${res.status}`); }
    badge.textContent = `Grabando ${i + 1} / ${total}`;
  }
  badge.textContent = `Listo: ${total} cuadros. Ahora: npm run encode`;
  return total;
}
