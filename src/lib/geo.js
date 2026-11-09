/**
 * 데모에서만 쓰는 직사각형 범위입니다. 실제 안양시 행정경계가 아닙니다.
 * [남서쪽 위도, 경도], [북동쪽 위도, 경도]
 */
export const DEMO_BOUNDS = [
  [37.350, 126.895],
  [37.440, 126.995],
];

export const ANYANG_CENTER = [37.392, 126.946];

export const PRESET_LOCATIONS = [
  { name: '범계역 일대', lat: 37.389, lng: 126.952, sub: '동안구' },
  { name: '안양역 일대', lat: 37.402, lng: 126.922, sub: '만안구' },
  { name: '평촌역 일대', lat: 37.394, lng: 126.964, sub: '동안구' },
  { name: '인덕원역 일대', lat: 37.401, lng: 126.976, sub: '동안구' },
];

// 지도에 클릭한 좌표가 사각형에 있는지 확인하며 사각형 경계도 포함합니다.
export function withinDemoBounds(lat, lng) {
  return lat >= DEMO_BOUNDS[0][0] && lat <= DEMO_BOUNDS[1][0]
    && lng >= DEMO_BOUNDS[0][1] && lng <= DEMO_BOUNDS[1][1];
}

const EPSILON = 1e-9;

function onSegment(point, a, b) {
  const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > EPSILON) return false;
  return point[0] >= Math.min(a[0], b[0]) - EPSILON
    && point[0] <= Math.max(a[0], b[0]) + EPSILON
    && point[1] >= Math.min(a[1], b[1]) - EPSILON
    && point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function inRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (onSegment(point, a, b)) return { inside: true, boundary: true };
    const intersect = (a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (intersect) inside = !inside;
  }
  return { inside, boundary: false };
}

function inPolygon(point, rings) {
  const outer = inRing(point, rings[0]);
  if (!outer.inside) return false;
  for (const hole of rings.slice(1)) {
    const tested = inRing(point, hole);
    if (tested.boundary) return true; // 경계선은 포함
    if (tested.inside) return false;
  }
  return true;
}

/** GeoJSON Polygon / MultiPolygon / Feature / FeatureCollection, 경계 포함. */
export function withinGeoJSON(lat, lng, geojson) {
  const point = [lng, lat]; // GeoJSON 좌표는 [경도, 위도]
  if (!geojson) return false;
  if (geojson.type === 'FeatureCollection') {
    return geojson.features.some(feature => withinGeoJSON(lat, lng, feature));
  }
  if (geojson.type === 'Feature') return withinGeoJSON(lat, lng, geojson.geometry);
  if (geojson.type === 'Polygon') return inPolygon(point, geojson.coordinates);
  if (geojson.type === 'MultiPolygon') return geojson.coordinates.some(rings => inPolygon(point, rings));
  return false;
}

export function nearestPreset(lat, lng) {
  const closest = PRESET_LOCATIONS.map(item => ({
    ...item,
    dist: Math.hypot((item.lat - lat) * 111, (item.lng - lng) * 88),
  })).sort((a, b) => a.dist - b.dist)[0];
  return closest.dist < 0.45 ? closest.name : '지도에서 선택한 위치';
}
