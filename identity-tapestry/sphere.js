(() => {
  'use strict';

  const canvas = document.getElementById('symbol-sphere');
  const stage = document.querySelector('.sphere-stage');
  const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const loadingPanel = document.getElementById('loading-panel');
  const loadingLabel = document.getElementById('loading-label');
  const loadingProgress = document.getElementById('loading-progress');
  const motionToggle = document.getElementById('motion-toggle');
  const resetButton = document.getElementById('reset-view');
  const detail = document.getElementById('symbol-detail');
  const selectedImage = document.getElementById('selected-symbol-image');
  const selectedId = document.getElementById('selected-symbol-id');
  const closeDetail = document.getElementById('close-detail');

  const TILE_SIZE = 48;
  const ATLAS_COLUMNS = 32;
  const CAMERA_DISTANCE = 3.4;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const DETAIL_LOAD_THRESHOLD = 0.9;
  const DETAIL_FADE_START = 0.75;
  const DETAIL_FADE_END = 1.05;
  const DETAIL_CACHE_LIMIT = 140;
  const DETAIL_LOAD_LIMIT = 6;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 12;
  const SNAP_DURATION = 650;
  const SELECTABLE_FRONT_DEPTH = 0.35;
  const FOCUS_RADIUS_RATIO = 0.34;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initialAutoMotion = !reducedMotion;

  let atlas = null;
  let symbols = [];
  let projected = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let yaw = -0.35;
  let pitch = 0.12;
  let zoom = 1;
  let targetZoom = 1;
  let velocityYaw = 0;
  let velocityPitch = 0;
  let autoMotion = false;
  let selectedIndex = -1;
  let dragging = false;
  let dragDistance = 0;
  let pointerX = 0;
  let pointerY = 0;
  let previousTime = performance.now();
  let ready = false;
  let snapRequested = false;
  let snapAnimation = null;
  let interfaceTimer = null;
  const detailImages = new Map();
  const detailPending = new Set();
  const detailPromises = new Map();
  const detailResolvers = new Map();
  const detailQueue = [];
  let activeDetailLoads = 0;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
  }

  function wakeInterface() {
    stage.classList.remove('is-ui-idle');
    window.clearTimeout(interfaceTimer);
    interfaceTimer = window.setTimeout(() => {
      if (dragging) {
        wakeInterface();
      } else {
        stage.classList.add('is-ui-idle');
      }
    }, 1000);
  }

  function createSpherePoints(records) {
    const total = records.length;
    return records.map((record, index) => {
      const y = 1 - (index / Math.max(1, total - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = index * GOLDEN_ANGLE;
      return {
        id: record.id,
        x: Math.cos(angle) * ring,
        y,
        z: Math.sin(angle) * ring,
        atlasX: (index % ATLAS_COLUMNS) * TILE_SIZE,
        atlasY: Math.floor(index / ATLAS_COLUMNS) * TILE_SIZE
      };
    });
  }

  function buildAtlas(records) {
    const rows = Math.ceil(records.length / ATLAS_COLUMNS);
    atlas = document.createElement('canvas');
    atlas.width = ATLAS_COLUMNS * TILE_SIZE;
    atlas.height = rows * TILE_SIZE;
    const atlasContext = atlas.getContext('2d', { alpha: true });
    atlasContext.fillStyle = '#ffffff';

    return new Promise((resolve, reject) => {
      let index = 0;

      function drawChunk() {
        const end = Math.min(index + 36, records.length);
        try {
          for (; index < end; index += 1) {
            const path = new Path2D(records[index].svg_path_data);
            const column = index % ATLAS_COLUMNS;
            const row = Math.floor(index / ATLAS_COLUMNS);
            const centerX = column * TILE_SIZE + TILE_SIZE / 2;
            const centerY = row * TILE_SIZE + TILE_SIZE / 2;
            atlasContext.save();
            atlasContext.translate(centerX, centerY);
            atlasContext.scale((TILE_SIZE - 8) / 1000, (TILE_SIZE - 8) / 1000);
            atlasContext.fill(path, 'evenodd');
            atlasContext.restore();
          }
        } catch (error) {
          reject(error);
          return;
        }

        const percent = Math.round((index / records.length) * 100);
        loadingLabel.textContent = `Preparing 1,445 symbols… ${percent}%`;
        loadingProgress.style.width = `${percent}%`;

        if (index < records.length) {
          window.setTimeout(drawChunk, 0);
        } else {
          resolve();
        }
      }

      drawChunk();
    });
  }

  function rotatePoint(point) {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const x1 = point.x * cosYaw - point.z * sinYaw;
    const z1 = point.x * sinYaw + point.z * cosYaw;
    return {
      x: x1,
      y: point.y * cosPitch - z1 * sinPitch,
      z: point.y * sinPitch + z1 * cosPitch
    };
  }

  function setAutoMotion(enabled) {
    autoMotion = enabled;
    motionToggle.setAttribute('aria-pressed', String(autoMotion));
    motionToggle.textContent = autoMotion ? 'Pause drift' : 'Resume drift';
  }

  function focusRadius() {
    return Math.min(width, height) * FOCUS_RADIUS_RATIO;
  }

  function nearestCenterItem() {
    const centerX = width / 2;
    const centerY = height / 2;
    let nearest = null;
    for (let index = projected.length - 1; index >= 0; index -= 1) {
      const item = projected[index];
      if (!item.selectable) continue;
      const distance = Math.hypot(item.x - centerX, item.y - centerY);
      if (!nearest || distance < nearest.distance) nearest = { item, distance };
    }
    return nearest?.item || null;
  }

  function beginSnap(index) {
    const symbol = symbols[index];
    if (!symbol) return;

    const horizontalRadius = Math.hypot(symbol.x, symbol.z);
    let targetYaw = Math.atan2(symbol.x, symbol.z);
    targetYaw += Math.round((yaw - targetYaw) / (Math.PI * 2)) * Math.PI * 2;
    const targetPitch = Math.atan2(symbol.y, horizontalRadius);

    setAutoMotion(false);
    snapRequested = false;
    velocityYaw = 0;
    velocityPitch = 0;
    requestDetailImage(symbol.id);
    snapAnimation = {
      start: performance.now(),
      fromYaw: yaw,
      fromPitch: pitch,
      targetYaw,
      targetPitch
    };
  }

  function snapNearestToCenter() {
    const nearest = nearestCenterItem();
    if (nearest) beginSnap(nearest.index);
  }

  function cacheDetailImage(id, image) {
    if (detailImages.has(id)) detailImages.delete(id);
    detailImages.set(id, image);
    while (detailImages.size > DETAIL_CACHE_LIMIT) {
      detailImages.delete(detailImages.keys().next().value);
    }
  }

  function loadNextDetailImage() {
    while (activeDetailLoads < DETAIL_LOAD_LIMIT && detailQueue.length) {
      const id = detailQueue.shift();
      activeDetailLoads += 1;
      fetch(`svgs/${id}.svg`)
        .then(response => {
          if (!response.ok) throw new Error(`SVG ${id} request failed: ${response.status}`);
          return response.text();
        })
        .then(source => {
          const whiteSource = source.replaceAll('currentColor', '#ffffff');
          const objectUrl = URL.createObjectURL(new Blob([whiteSource], { type: 'image/svg+xml' }));
          const image = new Image();
          image.decoding = 'async';
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            cacheDetailImage(id, image);
            finishDetailRequest(id, true);
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            finishDetailRequest(id, false);
          };
          image.src = objectUrl;
        })
        .catch(() => {
          finishDetailRequest(id, false);
        });
    }
  }

  function finishDetailRequest(id, succeeded) {
    detailPending.delete(id);
    activeDetailLoads -= 1;
    const resolve = detailResolvers.get(id);
    if (resolve) resolve(succeeded);
    detailResolvers.delete(id);
    detailPromises.delete(id);
    loadNextDetailImage();
  }

  function requestDetailImage(id) {
    if (detailImages.has(id)) return Promise.resolve(true);
    if (detailPromises.has(id)) return detailPromises.get(id);

    const promise = new Promise(resolve => detailResolvers.set(id, resolve));
    detailPromises.set(id, promise);
    detailPending.add(id);
    detailQueue.push(id);
    loadNextDetailImage();
    return promise;
  }

  function getDetailImage(id) {
    const image = detailImages.get(id);
    if (!image) return null;
    detailImages.delete(id);
    detailImages.set(id, image);
    return image;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    if (!ready || !atlas) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.39 * zoom;

    projected = symbols.map((symbol, index) => {
      const rotated = rotatePoint(symbol);
      const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE - rotated.z);
      let projectedX = centerX + rotated.x * radius * perspective;
      let projectedY = centerY - rotated.y * radius * perspective;
      if (zoom < 0.9) {
        projectedX = Math.round(projectedX * pixelRatio) / pixelRatio;
        projectedY = Math.round(projectedY * pixelRatio) / pixelRatio;
      }
      const centerDistance = Math.hypot(projectedX - centerX, projectedY - centerY);
      return {
        index,
        id: symbol.id,
        x: projectedX,
        y: projectedY,
        z: rotated.z,
        selectable: rotated.z >= SELECTABLE_FRONT_DEPTH && centerDistance <= focusRadius(),
        size: Math.max(5, radius * 0.045 * perspective),
        atlasX: symbol.atlasX,
        atlasY: symbol.atlasY
      };
    }).sort((a, b) => a.z - b.z);

    if (zoom >= DETAIL_LOAD_THRESHOLD) {
      projected
        .slice()
        .reverse()
        .filter(item => item.z > 0 && item.size >= 20 && item.x > -40 && item.x < width + 40 && item.y > -40 && item.y < height + 40)
        .slice(0, 48)
        .forEach(item => requestDetailImage(item.id));
    }

    const rawDetailBlend = Math.max(0, Math.min(1, (zoom - DETAIL_FADE_START) / (DETAIL_FADE_END - DETAIL_FADE_START)));
    const detailBlend = rawDetailBlend * rawDetailBlend * (3 - 2 * rawDetailBlend);

    for (const item of projected) {
      const depth = (item.z + 1) / 2;
      const size = item.size;
      const symbolAlpha = 0.09 + depth * 0.86;
      const detailImage = detailBlend > 0 ? getDetailImage(item.id) : null;
      if (detailImage) {
        context.globalAlpha = symbolAlpha * (1 - detailBlend);
        context.drawImage(
          atlas,
          item.atlasX,
          item.atlasY,
          TILE_SIZE,
          TILE_SIZE,
          item.x - size / 2,
          item.y - size / 2,
          size,
          size
        );
        context.globalAlpha = symbolAlpha * detailBlend;
        context.drawImage(detailImage, item.x - size / 2, item.y - size / 2, size, size);
      } else {
        const stableSize = size < 32 ? Math.max(1, Math.round(size * pixelRatio) / pixelRatio) : size;
        const stableX = size < 32 ? Math.round((item.x - stableSize / 2) * pixelRatio) / pixelRatio : item.x - stableSize / 2;
        const stableY = size < 32 ? Math.round((item.y - stableSize / 2) * pixelRatio) / pixelRatio : item.y - stableSize / 2;
        context.globalAlpha = symbolAlpha;
        context.drawImage(
          atlas,
          item.atlasX,
          item.atlasY,
          TILE_SIZE,
          TILE_SIZE,
          stableX,
          stableY,
          stableSize,
          stableSize
        );
      }

      if (item.index === selectedIndex) {
        context.save();
        context.globalAlpha = 1;
        context.strokeStyle = '#818cf8';
        context.lineWidth = 2;
        context.shadowColor = '#818cf8';
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(item.x, item.y, size * 0.72, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }
    context.globalAlpha = 1;

    const apertureRadius = focusRadius();
    const feather = context.createRadialGradient(
      centerX,
      centerY,
      apertureRadius * 0.68,
      centerX,
      centerY,
      apertureRadius * 1.48
    );
    feather.addColorStop(0, 'rgba(7, 9, 19, 0)');
    feather.addColorStop(0.38, 'rgba(7, 9, 19, 0.08)');
    feather.addColorStop(1, 'rgba(7, 9, 19, 0.58)');
    context.fillStyle = feather;
    context.fillRect(0, 0, width, height);
  }

  function animate(now) {
    const elapsed = Math.min(32, now - previousTime);
    previousTime = now;
    const zoomEase = 1 - Math.pow(0.78, elapsed / 16.67);
    zoom += (targetZoom - zoom) * zoomEase;

    if (snapAnimation) {
      const progress = Math.min(1, (now - snapAnimation.start) / SNAP_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      yaw = snapAnimation.fromYaw + (snapAnimation.targetYaw - snapAnimation.fromYaw) * eased;
      pitch = snapAnimation.fromPitch + (snapAnimation.targetPitch - snapAnimation.fromPitch) * eased;
      if (progress === 1) snapAnimation = null;
    } else if (!dragging) {
      if (autoMotion) velocityYaw -= 0.000000075 * elapsed;
      yaw += velocityYaw * elapsed;
      pitch += velocityPitch * elapsed;
      velocityYaw *= Math.pow(0.92, elapsed / 16.67);
      velocityPitch *= Math.pow(0.90, elapsed / 16.67);
      if (snapRequested && Math.abs(velocityYaw) < 0.00001 && Math.abs(velocityPitch) < 0.00001) {
        snapNearestToCenter();
      }
    }
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    draw();
    requestAnimationFrame(animate);
  }

  function selectNearest(x, y) {
    let nearest = null;
    for (let index = projected.length - 1; index >= 0; index -= 1) {
      const item = projected[index];
      if (!item.selectable) continue;
      const distance = Math.hypot(item.x - x, item.y - y);
      const hitRadius = Math.max(13, item.size * 0.75);
      if (distance <= hitRadius && (!nearest || distance < nearest.distance)) {
        nearest = { item, distance };
      }
    }
    if (!nearest) return null;

    selectedIndex = nearest.item.index;
    const id = nearest.item.id;
    requestDetailImage(id);
    selectedId.textContent = `#${id}`;
    selectedImage.src = `svgs/${id}.svg`;
    selectedImage.alt = `Extracted vector for symbol ${id}`;
    detail.hidden = false;
    return nearest.item;
  }

  function resetView() {
    yaw = -0.35;
    pitch = 0.12;
    zoom = 1;
    targetZoom = 1;
    velocityYaw = 0;
    velocityPitch = 0;
    snapRequested = false;
    snapAnimation = null;
  }

  canvas.addEventListener('pointerdown', event => {
    wakeInterface();
    setAutoMotion(false);
    snapRequested = false;
    snapAnimation = null;
    dragging = true;
    dragDistance = 0;
    pointerX = event.clientX;
    pointerY = event.clientY;
    velocityYaw = 0;
    velocityPitch = 0;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', event => {
    wakeInterface();
    if (!dragging) return;
    const deltaX = event.clientX - pointerX;
    const deltaY = event.clientY - pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
    yaw -= deltaX * 0.004;
    pitch += deltaY * 0.004;
    velocityYaw = -deltaX * 0.00012;
    velocityPitch = deltaY * 0.00012;
  });

  canvas.addEventListener('pointerup', event => {
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (dragDistance < 8) {
      const bounds = canvas.getBoundingClientRect();
      const selected = selectNearest(event.clientX - bounds.left, event.clientY - bounds.top);
      if (selected) beginSnap(selected.index);
      else snapRequested = true;
    } else {
      snapRequested = true;
    }
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    canvas.classList.remove('is-dragging');
    snapRequested = true;
  });

  canvas.addEventListener('wheel', event => {
    wakeInterface();
    event.preventDefault();
    targetZoom *= Math.exp(-event.deltaY * 0.001);
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
  }, { passive: false });

  motionToggle.addEventListener('click', () => {
    if (autoMotion) {
      setAutoMotion(false);
      velocityYaw = 0;
      velocityPitch = 0;
      snapNearestToCenter();
    } else {
      snapRequested = false;
      snapAnimation = null;
      setAutoMotion(true);
    }
  });

  resetButton.addEventListener('click', resetView);
  closeDetail.addEventListener('click', () => {
    selectedIndex = -1;
    detail.hidden = true;
  });

  window.addEventListener('keydown', event => {
    wakeInterface();
    const amount = event.shiftKey ? 0.2 : 0.08;
    if (event.key.startsWith('Arrow')) {
      setAutoMotion(false);
      snapAnimation = null;
      velocityYaw = 0;
      velocityPitch = 0;
      snapRequested = true;
    }
    if (event.key === 'ArrowLeft') yaw += amount;
    else if (event.key === 'ArrowRight') yaw -= amount;
    else if (event.key === 'ArrowUp') pitch -= amount;
    else if (event.key === 'ArrowDown') pitch += amount;
    else if (event.key === '+' || event.key === '=') targetZoom = Math.min(MAX_ZOOM, targetZoom * 1.1);
    else if (event.key === '-' || event.key === '_') targetZoom = Math.max(MIN_ZOOM, targetZoom / 1.1);
    else if (event.key === 'Escape') {
      selectedIndex = -1;
      detail.hidden = true;
    } else return;
    event.preventDefault();
  });

  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('pointermove', wakeInterface, { passive: true });
  window.addEventListener('pointerdown', wakeInterface, { passive: true });
  window.addEventListener('touchstart', wakeInterface, { passive: true });
  window.addEventListener('focusin', wakeInterface);
  resize();
  setAutoMotion(autoMotion);
  wakeInterface();
  requestAnimationFrame(animate);

  fetch('data.json')
    .then(response => {
      if (!response.ok) throw new Error(`Archive request failed: ${response.status}`);
      return response.json();
    })
    .then(database => Object.values(database)
      .filter(symbol => symbol.visible !== false && !symbol.deleted && symbol.svg_path_data)
      .sort((a, b) => a.id.localeCompare(b.id)))
    .then(async records => {
      if (records.length !== 1445) {
        throw new Error(`Expected 1,445 symbols but found ${records.length}`);
      }
      symbols = createSpherePoints(records);
      await buildAtlas(records);
      ready = true;
      draw();
      loadingLabel.textContent = 'Sharpening the nearest symbols…';
      const initialDetailIds = projected
        .slice()
        .reverse()
        .filter(item => item.z > 0 && item.x > -40 && item.x < width + 40 && item.y > -40 && item.y < height + 40)
        .slice(0, 48)
        .map(item => item.id);
      await Promise.all(initialDetailIds.map(requestDetailImage));
      setAutoMotion(initialAutoMotion);
      wakeInterface();
      loadingLabel.textContent = 'All 1,445 symbols ready';
      loadingProgress.style.width = '100%';
      window.setTimeout(() => loadingPanel.classList.add('is-complete'), 280);
    })
    .catch(error => {
      console.error(error);
      loadingPanel.classList.add('is-error');
      loadingLabel.textContent = 'The symbol sphere could not be loaded.';
    });
})();
