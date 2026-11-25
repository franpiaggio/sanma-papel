// Geographic layout helpers. All source geometry is in geography.json (OSM/ODbL).
// +x = southeast; +z = southwest/lake. The view looks from the lake to the town.
export function createGeoLayout(geo, { scale = .06, origin = geo.points.pierBase } = {}) {
  const eastPerDegree = 111320 * Math.cos(origin.lat * Math.PI / 180);
  const k = scale / Math.SQRT2;
  const project = (p) => {
    const lon = Array.isArray(p) ? p[0] : p.lon;
    const lat = Array.isArray(p) ? p[1] : p.lat;
    const E = (lon - origin.lon) * eastPerDegree;
    const N = (lat - origin.lat) * 111320;
    return [(E - N) * k, (-E - N) * k];
  };
  const pathOf = (f) => f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
  const projected = (kind) => geo.features.filter(f => f.properties.kind === kind).map(f => ({
    ...f.properties, id: f.id, points: pathOf(f).map(project), geometryType: f.geometry.type
  }));
  const shoreParts = geo.features.filter(f => f.properties.kind === 'shoreline').map(f => pathOf(f));
  const chains = joinLines(shoreParts);
  // The eastern bay is one continuous open shore. Keep disconnected extras separately.
  let shoreLonLat = chains.sort((a,b) => b.length-a.length)[0] || [];
  if (shoreLonLat.length && project(shoreLonLat[0])[0] > project(shoreLonLat.at(-1))[0]) shoreLonLat = [...shoreLonLat].reverse();
  const shoreline = shoreLonLat.map(project);
  // Continue beyond the authored frame into the lake on its SW side. This closes the
  // clipped bay without drawing a straight seam across its head or through the town.
  let waterPolygon = [];
  if (shoreLonLat.length) {
    const first = shoreLonLat[0], last = shoreLonLat.at(-1);
    const farWest = Math.min(first[0], last[0], geo.bbox[0]) - .025;
    const farSouth = Math.min(first[1], last[1], geo.bbox[1]) - .025;
    waterPolygon = [...shoreline, project([last[0], farSouth]), project([farWest, farSouth]), project([farWest, first[1]])];
  }
  const points = Object.fromEntries(Object.entries(geo.points).map(([key,p]) => {
    const [x,z] = project(p); return [key, { ...p, x, z }];
  }));
  return { scale, origin, project, points, shoreline, shoreLonLat, waterPolygon,
    streets: projected('street'), waterways: projected('waterway'), parks: projected('park'),
    buildings: projected('building'), piers: projected('pier'), pierAreas: projected('pier_area'),
    pedestrianAreas: projected('pedestrian_area'), beachBoundaries: projected('beach_boundary') };
}

/**
 * The real surroundings (geography-wide.json, OSM/ODbL): the Lácar arm between
 * its two forested shores, wood polygons, regional roads and streams, peaks.
 * `townBox` (lon/lat bbox of geography.json) lets callers skip road runs the
 * detailed town data already draws.
 */
export function createWideLayout(wide, layout, townBox) {
  const P = layout.project;
  const poly = (p) => ({ outer: p.outer.map(P), inner: (p.inner || []).map((r) => r.map(P)) });
  const inTown = ([lon, lat]) => lon >= townBox[0] && lon <= townBox[2] && lat >= townBox[1] && lat <= townBox[3];
  const outside = (pts) => {
    const runs = []; let run = [];
    for (const p of pts) { if (inTown(p)) { if (run.length > 1) runs.push(run); run = []; } else run.push(p); }
    if (run.length > 1) runs.push(run);
    return runs.map((r) => r.map(P));
  };
  return {
    lake: (wide.lake || []).map(poly),
    woods: (wide.wood || []).map(poly),
    roads: (wide.roads || []).flatMap((r) => outside(r.points).map((points) => ({ ...r, points }))),
    streams: (wide.streams || []).flatMap((s) => outside(s.points).map((points) => ({ ...s, points }))),
    peaks: (wide.peaks || []).map((p) => { const [x, z] = P([p.lon, p.lat]); return { ...p, x, z }; }),
  };
}

export function joinLines(lines, tolerance = .000001) {
  const near = (a,b) => Math.abs(a[0]-b[0]) < tolerance && Math.abs(a[1]-b[1]) < tolerance;
  const pending = lines.filter(p => p.length > 1).map(p => p.map(x => [...x]));
  const chains = [];
  while (pending.length) {
    let chain = pending.shift(), changed = true;
    while (changed) {
      changed = false;
      for (let i=0;i<pending.length;i++) {
        let part = pending[i];
        if (near(chain.at(-1),part[0])) chain = [...chain,...part.slice(1)];
        else if (near(chain.at(-1),part.at(-1))) chain = [...chain,...part.slice(0,-1).reverse()];
        else if (near(chain[0],part.at(-1))) chain = [...part.slice(0,-1),...chain];
        else if (near(chain[0],part[0])) chain = [...part.slice(1).reverse(),...chain];
        else continue;
        pending.splice(i,1); changed=true; break;
      }
    }
    chains.push(chain);
  }
  return chains;
}
