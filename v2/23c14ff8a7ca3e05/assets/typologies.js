// Impresiones originales derivadas de las referencias de references.json, CC BY-SA 4.0.
// Una sola paleta y un solo maestro por tipo: nunca una textura por edificio.
const type = (id, name, storeys, wallH, roofH, facade, roof, timber, extra = {}) => ({
  id, name, storeys, w: 4, d: 3.2, wallH, roofH,
  palette: { facade, roof, timber, stone: '#92918a', trim: '#e9dfc9', glass: '#5b7a7c' },
  surface: 'stucco', frontGable: false, balcony: false, shop: false,
  ...extra,
});

export const TYPOLOGIES = [
  type('timber-cabin', 'Cabaña de tablas y chapa', 1, 2.4, 1.65, '#c9b78f', '#657175', '#aa7545',
    { surface: 'timber', frontGable: true, plinth: .28, chimney: true, refs: [29, 69] }),
  type('stucco-house', 'Casa revocada con zócalo de piedra', 1, 2.4, 1.05, '#e1ddcd', '#985f50', '#8c684b',
    { plinth: .22, chimney: true, refs: [65] }),
  type('stone-timber', 'Casa de piedra y madera', 2, 3.8, 1.75, '#d4c9ae', '#687173', '#ad8254',
    { surface: 'mixed', frontGable: true, plinth: .26, balcony: true, chimney: true, refs: [58] }),
  type('timber-balcony', 'Casa de madera con balcón corrido', 2, 3.8, 1.2, '#dfd8c3', '#7b6254', '#ba9851',
    { surface: 'mixed', balcony: true, plinth: .10, refs: [21, 56] }),
  type('town-shop', 'Local bajo con vidriera y alero', 1, 2.4, .65, '#d3b67c', '#8b6857', '#875f43',
    { shop: true, canopy: true, plinth: .16, refs: [66, 68] }),
  type('alpine-shop', 'Frente comercial con planta alta', 2, 3.8, 1.3, '#e4dbc3', '#5e6768', '#a37b50',
    { shop: true, canopy: true, dormers: true, plinth: .13, refs: [33, 44] }),
  type('half-timber', 'Frente de revoque y entramado', 2, 3.8, 1.0, '#dfddce', '#655b52', '#6d5140',
    { halfTimber: true, shop: true, plinth: .12, refs: [16, 52] }),
  type('low-apartment', 'Edificio bajo con balcones', 3, 5.3, .28, '#ded4b9', '#736c60', '#8a7055',
    { flat: true, balcony: true, plinth: .18, refs: [14] }),
  type('modern-flat', 'Volumen de revoque y cubierta plana', 2, 3.8, .20, '#d6d4c7', '#5f6765', '#62645c',
    { flat: true, shop: true, plinth: .12, refs: [36, 38] }),
  type('lodge', 'Hostería de madera oscura', 2, 3.8, 2.1, '#b29a7c', '#5c6568', '#76553f',
    { surface: 'timber', dormers: true, plinth: .25, chimney: true, refs: [10, 46] }),
];

export const TYPE_BY_ID = new Map(TYPOLOGIES.map(t => [t.id, t]));

export function chooseTypology(p, evidence = {}) {
  if (TYPE_BY_ID.has(evidence.typology)) return evidence.typology;
  const use = `${evidence.use || ''} ${evidence.tourism || ''} ${evidence.shop ? 'shop' : ''} ${evidence.amenity || ''} ${p.buildingUse || ''} ${evidence.name || ''}`.toLowerCase();
  const floors = Number(evidence.levels) || p.storeys || 1;
  if (/hotel|hoster|guest_house|cabañas/.test(use)) return 'lodge';
  if (evidence.roof_shape === 'flat') return floors >= 3 ? 'low-apartment' : 'modern-flat';
  if (/commercial|retail|restaurant|cafe|bar|shop/.test(use)) return floors > 1 ? 'alpine-shop' : 'town-shop';
  if (floors >= 3) return 'low-apartment';
  const key = String(p.sourceId ?? p.seed ?? 1);
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  if (floors > 1) return ['stone-timber', 'timber-balcony', 'half-timber', 'stone-timber', 'timber-balcony'][hash % 5];
  return ['stucco-house', 'timber-cabin', 'stucco-house', 'stucco-house'][hash % 4];
}

export function fitProfile(p, typology) {
  const t = TYPE_BY_ID.get(typology);
  const wallH = .17 + t.storeys * .255;
  return { ...p, typology, storeys: t.storeys, wallH, roofH: wallH * t.roofH / t.wallH };
}
