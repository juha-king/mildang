import { useMemo, useEffect, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Rectangle, TileLayer, Tooltip, useMap, useMapEvents, GeoJSON, ZoomControl } from 'react-leaflet';
import { ANYANG_CENTER, DEMO_BOUNDS, PRESET_LOCATIONS } from '../lib/geo.js';
import KakaoMap from './KakaoMap.jsx';

function ClickHandler({ onClickPoint }) {
  useMapEvents({
    click: event => onClickPoint(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function SyncMapSize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function TrackpadGestures() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let frame = null;
    let deltaX = 0;
    let deltaY = 0;
    let pendingZoom = null;
    let zoomPoint = null;
    let zoomTimer = null;
    let safariStartZoom = null;

    function applyGesture() {
      frame = null;
      map.stop();
      map.panBy([deltaX, deltaY], { animate: false });
      deltaX = 0;
      deltaY = 0;
    }

    function applyZoom() {
      zoomTimer = null;
      if (pendingZoom === null) return;
      map.setZoomAround(zoomPoint, pendingZoom, { animate: true });
      pendingZoom = null;
    }

    function queueZoom(event, zoom) {
      pendingZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
      zoomPoint = map.mouseEventToContainerPoint(event);
      deltaX = 0;
      deltaY = 0;
      window.clearTimeout(zoomTimer);
      zoomTimer = window.setTimeout(applyZoom, 70);
    }

    function onWheel(event) {
      if (event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Safari may also emit wheel events during its native pinch gesture.
      if (safariStartZoom !== null) return;
      const lineSize = 16;
      const scaleX = event.deltaMode === 2 ? container.clientWidth : event.deltaMode === 1 ? lineSize : 1;
      const scaleY = event.deltaMode === 2 ? container.clientHeight : event.deltaMode === 1 ? lineSize : 1;
      if (event.ctrlKey) {
        queueZoom(event, (pendingZoom ?? map.getZoom()) - event.deltaY * scaleY / 200);
        return;
      }
      deltaX += event.deltaX * scaleX;
      deltaY += event.deltaY * scaleY;
      if (frame === null) frame = requestAnimationFrame(applyGesture);
    }

    function onGestureStart(event) {
      // Touchscreen pinches are already handled by Leaflet touchZoom.
      if (navigator.maxTouchPoints > 0) return;
      event.preventDefault();
      map.stop();
      safariStartZoom = map.getZoom();
      deltaX = 0;
      deltaY = 0;
    }

    function onGestureChange(event) {
      if (safariStartZoom === null) return;
      event.preventDefault();
      if (Number.isFinite(event.scale) && event.scale > 0) {
        queueZoom(event, map.getScaleZoom(event.scale, safariStartZoom));
      }
    }

    function onGestureEnd(event) {
      onGestureChange(event);
      safariStartZoom = null;
    }

    container.addEventListener('wheel', onWheel, { passive: false, capture: true });
    container.addEventListener('gesturestart', onGestureStart, { passive: false });
    container.addEventListener('gesturechange', onGestureChange, { passive: false });
    container.addEventListener('gestureend', onGestureEnd, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel, true);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
      container.removeEventListener('gestureend', onGestureEnd);
      if (frame !== null) cancelAnimationFrame(frame);
      window.clearTimeout(zoomTimer);
    };
  }, [map]);
  return null;
}

function MoveToSelection({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [map, selected?.lat, selected?.lng]);
  return null;
}

export default function AnyangMap(props) {
  const [kakaoError, setKakaoError] = useState('');
  const wantsKakao = import.meta.env.VITE_MAP_PROVIDER === 'kakao';
  const hasKakaoKey = Boolean(import.meta.env.VITE_KAKAO_MAP_JS_KEY?.trim());

  if (wantsKakao && hasKakaoKey && !kakaoError) {
    return <KakaoMap {...props} onLoadError={setKakaoError} />;
  }

  const providerNotice = wantsKakao
    ? `OpenStreetMap으로 표시 중 · ${kakaoError || '카카오 JavaScript 키가 설정되지 않았습니다.'}`
    : '';
  return <LeafletAnyangMap {...props} providerNotice={providerNotice} />;
}

function LeafletAnyangMap({ selected, boundary, radius, onSelect, providerNotice }) {
  const [tileError, setTileError] = useState(false);
  const tileEvents = useMemo(() => {
    let batchFailed = false;
    return {
      loading: () => { batchFailed = false; },
      tileerror: () => {
        batchFailed = true;
        setTileError(true);
      },
      load: () => setTileError(batchFailed),
    };
  }, []);
  const markerIcon = useMemo(() => L.divIcon({
    className: 'custom-map-marker',
    html: '<div class="marker-halo"><div class="marker-dot"></div></div>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  }), []);
  const presetIcon = useMemo(() => L.divIcon({
    className: 'preset-map-marker',
    html: '<div class="preset-pin"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }), []);

  return (
    <div className="map-frame">
      <MapContainer center={ANYANG_CENTER} zoom={12} scrollWheelZoom={false} zoomSnap={0} touchZoom={true} zoomControl={false} className="leaflet-map" minZoom={10} maxZoom={18}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={tileEvents}
        />
        {boundary ? (
          <>
            <GeoJSON key="anyang-boundary-outline" data={boundary}
              style={{ color: '#FEFFFE', weight: 7, opacity: 0.95, fillOpacity: 0 }} />
            <GeoJSON key="anyang-boundary" data={boundary}
              style={{ color: '#5C80BC', weight: 3, fillColor: '#5C80BC', fillOpacity: 0.1 }} />
          </>
        ) : (
          <>
            <Rectangle bounds={DEMO_BOUNDS}
              pathOptions={{ color: '#FEFFFE', dashArray: '7 6', weight: 8, fillOpacity: 0 }} />
            <Rectangle bounds={DEMO_BOUNDS}
              pathOptions={{ color: '#5C80BC', dashArray: '7 6', weight: 4, fillColor: '#5C80BC', fillOpacity: 0.1 }} />
          </>
        )}
        {PRESET_LOCATIONS.map(place => (
          <Marker key={place.name} position={[place.lat, place.lng]} icon={presetIcon} eventHandlers={{ click: () => onSelect(place.lat, place.lng, place.name) }}>
            <Tooltip direction="top" offset={[0, -7]}>{place.name}</Tooltip>
          </Marker>
        ))}
        {selected && (
          <>
            <Circle center={[selected.lat, selected.lng]} radius={radius} pathOptions={{ color: '#FEFFFE', fillOpacity: 0, weight: 6 }} />
            <Circle center={[selected.lat, selected.lng]} radius={radius} pathOptions={{ color: '#3D3B30', fillColor: '#5C80BC', fillOpacity: 0.1, weight: 2, dashArray: '4 4' }} />
            <Marker position={[selected.lat, selected.lng]} icon={markerIcon}>
              <Tooltip direction="top" offset={[0, -20]} permanent>{selected.name}</Tooltip>
            </Marker>
          </>
        )}
        <SyncMapSize />
        <TrackpadGestures />
        <ClickHandler onClickPoint={onSelect} />
        <MoveToSelection selected={selected} />
        <ZoomControl position="bottomright" />
      </MapContainer>
      {(tileError || providerNotice) && (
        <div className="map-load-error" role="status">
          {providerNotice && <div>{providerNotice}</div>}
          {tileError && <div>배경 지도 일부를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.</div>}
        </div>
      )}
    </div>
  );
}
