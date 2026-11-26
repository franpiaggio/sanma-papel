
    const text = document.getElementById('load-text'), bar = document.getElementById('load-bar');
    window.__loading = (msg, pct) => { if (pct != null) bar.style.width = pct + '%'; };   // stages only move the bar
    document.getElementById('load-retry').addEventListener('click', () => location.reload());
    // Let the loader paint before the heavy imports start.
    await new Promise((r) => { let d = false; const go = () => { if (!d) { d = true; setTimeout(r, 0); } }; requestAnimationFrame(go); setTimeout(go, 60); });
    const Q = new URLSearchParams(location.search);
    try {
      await import('./scene.js');
    } catch (error) {
      console.error(error);
      text.textContent = 'No se pudo armar la maqueta. ' + (error?.message || '');
      text.classList.remove('loading-accessible');
      document.getElementById('load-retry').hidden = false;
      document.querySelector('.loading-range').hidden = true;
      throw error;
    }
    window.__loading('Listo', 100);
    // Warm up behind the loader: compile every shader, upload every texture and
    // let frames render until they come out steady, then start the tour. The
    // first seconds used to stutter while the GPU caught up with the rise.
    {
      const S = window.__sanMartin, R = S.H.renderer;
      const startup = S.startupT = {}, compileAt = performance.now();
      window.__loading('', 94);
      R.compile(S.H.scene, S.H.camera);
      startup.compileMs = Math.round(performance.now() - compileAt);
      const uploadAt = performance.now();
      const seen = new Set(), seenMaterials = new Set();
      S.H.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) { if (!m || seenMaterials.has(m)) continue; seenMaterials.add(m);
          for (const k of ['map', 'normalMap', 'emissiveMap']) { const t = m[k]; if (t && !seen.has(t)) { seen.add(t); R.initTexture(t); } } } });
      startup.uploadMs = Math.round(performance.now() - uploadAt);
      const t0 = performance.now(); let last = t0, steady = 0;
      await new Promise((resolve) => { const tick = () => { const now = performance.now(), dt = now - last; last = now;
        steady = dt < 34 ? steady + 1 : 0;
        if (steady >= 10 || now - t0 > 6000) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      startup.warmupMs = Math.round(performance.now() - t0);
      window.__loading('', 100);
      if(Q.get('landmark')&&!Q.has('record')){
        if(!S.focusLandmark(Q.get('landmark'))&&!matchMedia('(prefers-reduced-motion:reduce)').matches)S.tour.restart();
      }else if (!Q.has('record') && !matchMedia('(prefers-reduced-motion:reduce)').matches) S.tour.restart();
    }
    requestAnimationFrame(() => document.body.classList.add('ready'));
    if (Q.has('capture') || Q.has('record')) document.querySelector('.edition').hidden = true;
    if (new URLSearchParams(location.search).has('record')) {
      document.querySelector('.controls').hidden = true;
      (await import('./record.js')).record();
    }
    let timer;
    const wake = () => { document.body.classList.remove('idle'); clearTimeout(timer); timer = setTimeout(() => document.body.classList.add('idle'), 2500); };
    for (const type of ['pointermove', 'pointerdown', 'keydown']) addEventListener(type, wake, { passive: true });
    wake();
  