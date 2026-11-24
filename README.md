# San Martín de los Andes en papel

Maqueta de papel *pop-up* en 3D de San Martín de los Andes sobre el mapa real. Se ve en el navegador; un click pliega la zona que tocás.

**Ver:** https://franpiaggio.github.io/sanma-papel/

Hecho con three.js, el kit [papercraft de xikhar](https://github.com/xikhar/papercraft) y datos de OpenStreetMap. Todo se dibuja con código, sin imágenes.

## Cómo se hizo

1. **Mapa real.** Calles, costa, el brazo del lago Lácar, bosques, la RN40/RP48 y los hitos (muelle, terminal, Intendencia, Plaza San Martín) salen de OpenStreetMap. Se convierten a coordenadas 3D: 0.06 unidades por metro, con el origen en el muelle.
2. **Papel.** Cada casa, árbol y cerro es una "carta" de cartulina con grosor, impresa con código (ventanas, tejas, hojas), que se levanta desde la hoja con una bisagra y un resorte. El aspecto de maqueta fotografiada (papel mate, sombras cálidas, tilt-shift, grano) viene del kit papercraft de xikhar.
3. **El valle.** Los cerros rodean el pueblo como en la realidad y se ubican solos sin pararse sobre ningún camino.
4. **Rendimiento.** Hay unas 30 mil piezas. Se agrupan por material para dibujarse en pocas llamadas (`BatchedMesh`), las sombras se recalculan solo cuando algo se mueve, las piezas quietas se congelan y en el celular se usa una versión más liviana.
5. **Recorrido.** Primero suben los cerros, después el pueblo en ola desde la costa; la cámara hace zoom al muelle y pasea hasta la plaza. Arrastrá para girar, usá la rueda para acercar o alejar, y hacé click para plegar una zona.

Esta carpeta es solo la web publicada; el código fuente está en un repo privado.

## Créditos y licencias

- Datos del mapa: © colaboradores de OpenStreetMap, [ODbL](https://opendatacommons.org/licenses/odbl/) (`geography*.json`).
- `lib/paperkit-*.js`, `lib/paper-*.js`, `harness.js`: basados en [xikhar/papercraft](https://github.com/xikhar/papercraft), licencia MIT.
- `vendor/three.*.js`: [three.js](https://threejs.org), licencia MIT.
