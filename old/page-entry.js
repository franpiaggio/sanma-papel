
    const text = document.getElementById('load-text'), bar = document.getElementById('load-bar');
    window.__loading = (msg, pct) => { if (pct != null) bar.style.width = pct + '%'; };   // stages only move the bar
    document.getElementById('load-retry').addEventListener('click', () => location.reload());
    // Let the loader paint before the heavy imports start.
    await new Promise((r) => { let d = false; const go = () => { if (!d) { d = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 60); });
    // Experimental: ?bake records every print and uploads it (needs BAKE_DIR on the
    // dev server); ?baked loads those pre-rendered prints instead of painting them.
    const Q = new URLSearchParams(location.search);
    if (Q.has('bake')) globalThis.__printBake = { mode: 'record', seq: 0, out: [] };
    if (Q.has('baked')) {
      const t0 = performance.now();
      const manifest = await (await fetch('./baked/manifest.json')).json();
      const load = async (name) => createImageBitmap(await (await fetch('./baked/' + name)).blob());
      const src = new Array(manifest.prints.length);
      let done = 0, next = 0;
      const worker = async () => { while (next < manifest.prints.length) { const i = next++, m = manifest.prints[i];
        src[i] = { ...m, img: await load(`p${String(i).padStart(5, '0')}.webp`), glowImg: m.glow ? await load(`p${String(i).padStart(5, '0')}g.webp`) : null };
        bar.style.width = Math.round(++done / manifest.prints.length * 60) + '%'; } };
      const ground = load('ground.webp');
      await Promise.all(Array.from({ length: 8 }, worker));
      globalThis.__printBake = { mode: 'replay', seq: 0, src, ground: await ground };
      console.info('[baked] prints loaded in', Math.round(performance.now() - t0), 'ms');
    }
    try {
      await import('./scene.js');
    } catch (error) {
      console.error(error);
      text.textContent = 'No se pudo armar la maqueta. ' + (error?.message || '');
      document.getElementById('load-retry').hidden = false;
      document.querySelector('.fold').hidden = true;
      throw error;
    }
    window.__loading('Listo', 100);
    if (Q.has('bake')) {
      const bake = globalThis.__printBake, blobOf = (c) => c.convertToBlob ? c.convertToBlob({ type: 'image/webp', quality: 0.92 }) : new Promise((r) => c.toBlob(r, 'image/webp', 0.92));
      const put = async (name, body) => { const r = await fetch('/__bake/' + name, { method: 'POST', body }); if (r.status !== 204) throw new Error('bake upload ' + r.status); };
      const prints = [];
      for (let i = 0; i < bake.out.length; i++) {
        const o = bake.out[i]; if (!o) { prints.push(null); continue; }
        const n = `p${String(i).padStart(5, '0')}`;
        await put(n + '.webp', await blobOf(o.canvas));
        if (o.glow) await put(n + 'g.webp', await blobOf(o.glow));
        prints.push({ w: o.w, h: o.h, mean: o.mean, glow: !!o.glow });
        text.textContent = `Horneando ${i + 1} / ${bake.out.length}`;
      }
      await put('ground.webp', await blobOf(bake.groundCanvas));
      await put('manifest.json', JSON.stringify({ prints }));
      text.textContent = 'Horneado listo';
      console.info('[bake] done', prints.length);
    }
    // Warm up behind the loader: compile every shader, upload every texture and
    // let frames render until they come out steady, then start the tour. The
    // first seconds used to stutter while the GPU caught up with the rise.
    {
      const S = window.__sanMartin, R = S.H.renderer;
      window.__loading('', 94);
      R.compile(S.H.scene, S.H.camera);
      const seen = new Set();
      S.H.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) for (const k of ['map', 'normalMap', 'emissiveMap']) { const t = m?.[k]; if (t && !seen.has(t)) { seen.add(t); R.initTexture(t); } } });
      const t0 = performance.now(); let last = t0, steady = 0;
      await new Promise((resolve) => { const tick = () => { const now = performance.now(), dt = now - last; last = now;
        steady = dt < 34 ? steady + 1 : 0;
        if (steady >= 10 || now - t0 > 6000) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      window.__loading('', 100);
      if (!Q.has('record') && !Q.has('bake')) S.tour.restart();
    }
    requestAnimationFrame(() => document.body.classList.add('ready'));
    if (new URLSearchParams(location.search).has('record')) {
      document.querySelector('.controls').hidden = true;
      (await import('./record.js')).record();
    }
    let timer;
    const wake = () => { document.body.classList.remove('idle'); clearTimeout(timer); timer = setTimeout(() => document.body.classList.add('idle'), 2500); };
    for (const type of ['pointermove', 'pointerdown', 'keydown']) addEventListener(type, wake, { passive: true });
    wake();
  