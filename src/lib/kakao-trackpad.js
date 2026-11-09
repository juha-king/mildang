// Capture trackpad events before the SDK's wheel-to-zoom handler.
export function bindKakaoTrackpad(container, map, maps) {
  let frame = null;
  let dx = 0;
  let dy = 0;
  let targetLevel = map.getLevel();
  let zoomAnchor = null;
  let zoomPending = false;
  let zoomTimer = null;
  let lastPinchAt = 0;
  let safariStartLevel = null;

  function flush() {
    frame = null;
    if (dx || dy) {
      const projection = map.getProjection();
      const center = projection.containerPointFromCoords(map.getCenter());
      map.setCenter(projection.coordsFromContainerPoint(new maps.Point(center.x + dx, center.y + dy)));
    }
    dx = 0;
    dy = 0;
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(flush);
  }

  function applyZoom() {
    zoomTimer = null;
    if (!zoomPending) return;
    map.setLevel(Math.round(targetLevel), { anchor: zoomAnchor, animate: true });
    zoomPending = false;
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function queueZoom(event, level) {
    targetLevel = Math.max(1, Math.min(14, level));
    const rect = container.getBoundingClientRect();
    zoomAnchor = map.getProjection().coordsFromContainerPoint(
      new maps.Point(event.clientX - rect.left, event.clientY - rect.top));
    zoomPending = true;
    dx = 0;
    dy = 0;
    window.clearTimeout(zoomTimer);
    zoomTimer = window.setTimeout(applyZoom, 70);
  }

  function onWheel(event) {
    if (event.metaKey) return;
    consume(event);
    if (safariStartLevel !== null) return;
    const sx = event.deltaMode === 2 ? container.clientWidth : event.deltaMode === 1 ? 16 : 1;
    const sy = event.deltaMode === 2 ? container.clientHeight : event.deltaMode === 1 ? 16 : 1;
    if (event.ctrlKey) {
      const now = performance.now();
      if (now - lastPinchAt > 250) targetLevel = map.getLevel();
      lastPinchAt = now;
      queueZoom(event, targetLevel + event.deltaY * sy / 200);
    } else {
      dx += event.deltaX * sx;
      dy += event.deltaY * sy;
      schedule();
    }
  }

  function onGestureStart(event) {
    // Mobile touch gestures continue to use the Kakao SDK.
    if (navigator.maxTouchPoints > 0) return;
    consume(event);
    safariStartLevel = map.getLevel();
    dx = 0;
    dy = 0;
  }

  function onGestureChange(event) {
    if (safariStartLevel === null) return;
    consume(event);
    if (Number.isFinite(event.scale) && event.scale > 0) {
      queueZoom(event, safariStartLevel - Math.log2(event.scale));
    }
  }

  function onGestureEnd(event) {
    onGestureChange(event);
    safariStartLevel = null;
  }

  const handlers = {
    wheel: onWheel,
    gesturestart: onGestureStart,
    gesturechange: onGestureChange,
    gestureend: onGestureEnd,
  };
  for (const [name, handler] of Object.entries(handlers)) {
    container.addEventListener(name, handler, { passive: false, capture: true });
  }
  return () => {
    for (const [name, handler] of Object.entries(handlers)) {
      container.removeEventListener(name, handler, true);
    }
    if (frame !== null) cancelAnimationFrame(frame);
    window.clearTimeout(zoomTimer);
  };
}
