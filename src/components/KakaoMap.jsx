/**
 * 선택형 카카오맵 어댑터. VITE_MAP_PROVIDER=kakao 와 웹용 JavaScript 키를 설정해야 사용합니다.
 * JavaScript 키는 지도 SDK를 로드하기 위한 공개 키이며, GPT/REST 비밀키와 혼동하면 안 됩니다.
 */
import { useEffect, useRef, useState } from 'react';
import { bindKakaoTrackpad } from '../lib/kakao-trackpad.js';
import { ANYANG_CENTER, constrainMapCenter, DEMO_BOUNDS, PRESET_LOCATIONS } from '../lib/geo.js';

let pendingSdk = null;
function loadKakaoSdk(key) {
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
  if (pendingSdk) return pendingSdk;
  pendingSdk = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('카카오 지도 SDK 로딩 실패 · 키와 도메인 등록을 확인해 주세요.'));
    }
    const timeout = window.setTimeout(fail, 10000);
    script.onload = () => {
      try {
        window.kakao.maps.load(() => {
          if (!window.kakao?.maps?.Map) {
            fail();
            return;
          }
          window.clearTimeout(timeout);
          resolve(window.kakao.maps);
        });
      } catch {
        fail();
      }
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { pendingSdk = null; throw error; });
  return pendingSdk;
}

function polygonsFromGeoJSON(data) {
  if (!data) return [];
  if (data.type === 'FeatureCollection') return data.features.flatMap(polygonsFromGeoJSON);
  if (data.type === 'Feature') return polygonsFromGeoJSON(data.geometry);
  if (data.type === 'Polygon') return [data.coordinates];
  if (data.type === 'MultiPolygon') return data.coordinates;
  return [];
}

export default function KakaoMap({ selected, boundary, radius, onSelect, onLoadError }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const onSelectRef = useRef(onSelect);
  const overlaysRef = useRef([]);
  const [ready, setReady] = useState(false);
  const jsKey = import.meta.env.VITE_KAKAO_MAP_JS_KEY.trim();
  onSelectRef.current = onSelect;

  useEffect(() => {
    let mounted = true;
    let map = null;
    let listener = null;
    let boundsListener = null;
    let observer = null;
    let removeTrackpad = null;
    loadKakaoSdk(jsKey).then(kakao => {
      if (!mounted || !mapElement.current) return;
      const maps = kakao;
      map = new maps.Map(mapElement.current, {
        center: new maps.LatLng(...ANYANG_CENTER), level: 6,
      });
      mapInstance.current = map;
      map.setMinLevel(1);
      map.setMaxLevel(8);
      removeTrackpad = bindKakaoTrackpad(mapElement.current, map, maps);
      listener = event => onSelectRef.current(event.latLng.getLat(), event.latLng.getLng());
      maps.event.addListener(map, 'click', listener);
      boundsListener = () => {
        const center = map.getCenter();
        const constrained = constrainMapCenter(center.getLat(), center.getLng());
        if (center.getLat() !== constrained.lat || center.getLng() !== constrained.lng) {
          map.panTo(new maps.LatLng(constrained.lat, constrained.lng));
        }
      };
      maps.event.addListener(map, 'idle', boundsListener);
      observer = new ResizeObserver(() => {
        const center = map.getCenter();
        map.relayout();
        map.setCenter(center);
      });
      observer.observe(mapElement.current);
      setReady(true);
    }).catch(error => { if (mounted) onLoadError(error.message); });
    return () => {
      mounted = false;
      observer?.disconnect();
      removeTrackpad?.();
      if (map && listener && window.kakao?.maps?.event) {
        window.kakao.maps.event.removeListener(map, 'click', listener);
      }
      if (map && boundsListener && window.kakao?.maps?.event) {
        window.kakao.maps.event.removeListener(map, 'idle', boundsListener);
      }
      overlaysRef.current.forEach(overlay => overlay.setMap(null));
      overlaysRef.current = [];
      mapInstance.current = null;
    };
  }, [jsKey, onLoadError]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const maps = window.kakao.maps;
    const map = mapInstance.current;
    overlaysRef.current.forEach(item => item.setMap(null));
    const overlays = [];
    const makeMarkerImage = color => {
      const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 2C8.3 2 2 8.3 2 16c0 10 14 22 14 22s14-12 14-22C30 8.3 23.7 2 16 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#FFFFFF"/></svg>`;
      return new maps.MarkerImage(
        `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}`,
        new maps.Size(32, 40),
        { offset: new maps.Point(16, 40) },
      );
    };
    const presetMarkerImage = makeMarkerImage('#00B8D9');
    const selectedMarkerImage = makeMarkerImage('#245BFF');

    if (boundary) {
      for (const rings of polygonsFromGeoJSON(boundary)) {
        const path = rings.map(ring => ring.map(([lng, lat]) => new maps.LatLng(lat, lng)));
        overlays.push(new maps.Polygon({
          map, path: path.length === 1 ? path[0] : path,
          strokeWeight: 7, strokeColor: '#FFFFFF', strokeOpacity: 0.95,
          fillColor: '#FFFFFF', fillOpacity: 0,
        }));
        overlays.push(new maps.Polygon({
          map, path: path.length === 1 ? path[0] : path,
          strokeWeight: 3, strokeColor: '#245BFF', strokeOpacity: 1,
          fillColor: '#245BFF', fillOpacity: 0.1,
        }));
      }
    } else {
      overlays.push(new maps.Rectangle({
        map, bounds: new maps.LatLngBounds(
          new maps.LatLng(...DEMO_BOUNDS[0]), new maps.LatLng(...DEMO_BOUNDS[1])),
        strokeWeight: 8, strokeColor: '#FFFFFF', strokeStyle: 'dash',
        fillColor: '#FFFFFF', fillOpacity: 0,
      }));
      overlays.push(new maps.Rectangle({
        map, bounds: new maps.LatLngBounds(
          new maps.LatLng(...DEMO_BOUNDS[0]), new maps.LatLng(...DEMO_BOUNDS[1])),
        strokeWeight: 4, strokeColor: '#245BFF', strokeStyle: 'dash',
        fillColor: '#245BFF', fillOpacity: 0.1,
      }));
    }
    for (const place of PRESET_LOCATIONS) {
      const marker = new maps.Marker({ map, position: new maps.LatLng(place.lat, place.lng), image: presetMarkerImage });
      const handler = () => onSelectRef.current(place.lat, place.lng, place.name);
      maps.event.addListener(marker, 'click', handler);
      overlays.push(marker);
    }
    if (selected) {
      const position = new maps.LatLng(selected.lat, selected.lng);
      overlays.push(new maps.Circle({
        map, center: position, radius, strokeWeight: 6, strokeColor: '#FFFFFF',
        fillColor: '#FFFFFF', fillOpacity: 0,
      }));
      overlays.push(new maps.Circle({
        map, center: position, radius, strokeWeight: 2, strokeColor: '#14213D',
        fillColor: '#245BFF', fillOpacity: 0.1,
      }));
      overlays.push(new maps.Marker({ map, position, image: selectedMarkerImage, zIndex: 5 }));
      map.panTo(position);
    }
    overlaysRef.current = overlays;
    return () => {
      overlays.forEach(item => item.setMap(null));
      if (overlaysRef.current === overlays) overlaysRef.current = [];
    };
  }, [ready, selected?.lat, selected?.lng, radius, boundary]);

  return (
    <div className="map-frame">
      <div ref={mapElement} className="kakao-map" aria-label="카카오맵에서 위치 선택" />
      {ready && <div className="kakao-zoom-buttons" aria-label="지도 확대 축소">
        <button type="button" aria-label="지도 확대" onClick={() => mapInstance.current?.setLevel(Math.max(1, mapInstance.current.getLevel() - 1))}>+</button>
        <button type="button" aria-label="지도 축소" onClick={() => mapInstance.current?.setLevel(Math.min(14, mapInstance.current.getLevel() + 1))}>−</button>
      </div>}
    </div>
  );
}
