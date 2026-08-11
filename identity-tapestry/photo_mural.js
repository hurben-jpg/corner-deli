/**
 * Identity Tapestry - Photo-Direct Mural Studio
 * Maps and projects student symbols directly onto real MLSHS site photos.
 */

window.PhotoMuralApp = (function() {
  let container;
  let manifestData = null;
  let currentPhotoIndex = 0;
  let viewMode = 'split'; // 'split', 'side', 'overlay'
  let sliderPos = 50; // percentage
  let isDraggingSlider = false;

  async function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="photo-mural-layout">
        <!-- Top Toolbar -->
        <div class="pm-toolbar">
          <div class="pm-title-group">
            <h3>MLSHS Site Photo Mural Studio</h3>
            <span class="pm-subtitle" id="pm-photo-counter">Photo 1 of 38</span>
          </div>

          <div class="pm-view-controls">
            <span class="pm-label">View Mode:</span>
            <button class="pm-btn active" id="btn-pm-split">Before / After Slider ↔</button>
            <button class="pm-btn" id="btn-pm-side">Side-by-Side ◧</button>
            <button class="pm-btn" id="btn-pm-overlay">Full Mural Overlay 🎨</button>
          </div>

          <div class="pm-actions">
            <button class="btn btn-sm btn-secondary" id="btn-pm-prev">◀ Prev Photo</button>
            <button class="btn btn-sm btn-secondary" id="btn-pm-next">Next Photo ▶</button>
          </div>
        </div>

        <!-- Main Viewport Area -->
        <div class="pm-viewport">
          <!-- Split Slider View -->
          <div class="pm-stage split-mode" id="pm-stage">
            <div class="pm-layer pm-layer-original">
              <img id="pm-img-orig" src="" alt="Original Site Photo">
              <span class="pm-tag tag-orig">Original Site Photo</span>
            </div>

            <div class="pm-layer pm-layer-overlay" id="pm-layer-overlay" style="clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);">
              <img id="pm-img-overlay" src="" alt="Photo with Mural Symbols">
              <span class="pm-tag tag-mural">Student Symbols Applied</span>
              
              <!-- Interactive Symbol Hotspot Canvas Overlay -->
              <div class="pm-hotspot-layer" id="pm-hotspot-layer"></div>
            </div>

            <!-- Draggable Split Handle -->
            <div class="pm-slider-handle" id="pm-slider-handle" style="left: 50%;">
              <div class="handle-line"></div>
              <div class="handle-button">↔</div>
            </div>
          </div>

          <!-- Symbol Detail Tooltip Card -->
          <div class="pm-symbol-card hidden" id="pm-sym-card">
            <button class="sym-card-close" id="btn-pm-close-card">&times;</button>
            <div class="sym-card-header">
              <span class="sym-id-badge" id="pm-sym-id">#1032</span>
              <h4 id="pm-sym-title">Student Symbol</h4>
            </div>
            <div class="sym-card-body">
              <div class="sym-img-box">
                <img id="pm-sym-img" src="" alt="Symbol Preview">
              </div>
              <div class="sym-meta">
                <div><strong>Theme:</strong> <span id="pm-sym-theme">Identity</span></div>
                <div><strong>Placement:</strong> Painted Wall Surface</div>
              </div>
            </div>
            <button class="btn btn-sm btn-primary" style="width:100%" id="btn-pm-inspect">View in Visual Library 🔍</button>
          </div>
        </div>

        <!-- Bottom Photo Gallery Selector Strip -->
        <div class="pm-gallery-strip">
          <div class="strip-header">
            <span>Site Photos (38 Angles of MLSHS Painted Surfaces)</span>
          </div>
          <div class="strip-items" id="pm-thumb-items">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>
    `;

    // Load Photo Manifest JSON
    await loadManifest();

    // Attach Event Listeners
    setupEvents();
  }

  async function loadManifest() {
    try {
      const resp = await fetch('photo_manifest.json');
      const data = await resp.json();
      manifestData = data;

      renderPhoto(0);
      populateThumbs();
    } catch (e) {
      console.error('Error loading photo manifest:', e);
    }
  }

  function renderPhoto(index) {
    if (!manifestData || !manifestData.photos) return;

    if (index < 0) index = manifestData.photos.length - 1;
    if (index >= manifestData.photos.length) index = 0;

    currentPhotoIndex = index;
    const photo = manifestData.photos[index];

    document.getElementById('pm-photo-counter').textContent = `Photo ${index + 1} of ${manifestData.photos.length} (${photo.filename})`;

    const imgOrig = document.getElementById('pm-img-orig');
    const imgOverlay = document.getElementById('pm-img-overlay');

    let origUrl = photo.original_path;
    if (!origUrl.startsWith('/') && !origUrl.startsWith('../')) {
      origUrl = '../../' + origUrl;
    }

    imgOrig.src = origUrl;
    imgOverlay.src = photo.overlay_path;

    // Render interactive symbol hotspots
    renderHotspots(photo);

    // Update active thumb
    document.querySelectorAll('.pm-thumb-item').forEach((el, i) => {
      if (i === index) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  function renderHotspots(photo) {
    const layer = document.getElementById('pm-hotspot-layer');
    if (!layer || !photo.symbols) return;

    layer.innerHTML = '';

    photo.symbols.forEach(sym => {
      const [rX1, rY1, rX2, rY2] = sym.rel_bbox;

      const hotspot = document.createElement('div');
      hotspot.className = 'pm-hotspot-box';
      hotspot.style.left = `${(rX1 * 100).toFixed(2)}%`;
      hotspot.style.top = `${(rY1 * 100).toFixed(2)}%`;
      hotspot.style.width = `${((rX2 - rX1) * 100).toFixed(2)}%`;
      hotspot.style.height = `${((rY2 - rY1) * 100).toFixed(2)}%`;

      hotspot.addEventListener('mouseenter', () => {
        showSymbolCard(sym);
      });

      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        showSymbolCard(sym);
      });

      layer.appendChild(hotspot);
    });
  }

  function showSymbolCard(sym) {
    const card = document.getElementById('pm-sym-card');
    if (!card) return;

    document.getElementById('pm-sym-id').textContent = `#${sym.id}`;
    document.getElementById('pm-sym-title').textContent = sym.title || `Student Symbol #${sym.id}`;
    document.getElementById('pm-sym-theme').textContent = sym.theme || 'Identity Narrative';

    const imgEl = document.getElementById('pm-sym-img');
    imgEl.src = `svgs/${sym.id}.svg`;
    imgEl.onerror = () => { imgEl.src = `pngs/${sym.id}.png`; };

    card.classList.remove('hidden');

    document.getElementById('btn-pm-inspect').onclick = () => {
      if (window.switchTab) window.switchTab('library');
    };
  }

  function populateThumbs() {
    const container = document.getElementById('pm-thumb-items');
    if (!container || !manifestData || !manifestData.photos) return;

    container.innerHTML = '';

    manifestData.photos.forEach((photo, idx) => {
      let origUrl = photo.original_path;
      if (!origUrl.startsWith('/') && !origUrl.startsWith('../')) {
        origUrl = '../../' + origUrl;
      }
      const item = document.createElement('div');
      item.className = `pm-thumb-item ${idx === 0 ? 'active' : ''}`;
      item.innerHTML = `
        <img src="${origUrl}" alt="${photo.filename}" loading="lazy">
        <span class="thumb-lbl">#${idx+1} (${photo.symbols_applied_count} syms)</span>
      `;

      item.addEventListener('click', () => {
        renderPhoto(idx);
      });

      container.appendChild(item);
    });
  }

  function setupEvents() {
    const stage = document.getElementById('pm-stage');
    const handle = document.getElementById('pm-slider-handle');
    const overlayLayer = document.getElementById('pm-layer-overlay');

    function updateSlider(pct) {
      pct = Math.max(0, Math.min(100, pct));
      sliderPos = pct;
      handle.style.left = `${pct}%`;
      overlayLayer.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
    }

    // Drag handle events
    handle.addEventListener('mousedown', () => { isDraggingSlider = true; });
    window.addEventListener('mouseup', () => { isDraggingSlider = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingSlider || !stage) return;
      const rect = stage.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      updateSlider(pct);
    });

    // Touch events for mobile/tablet
    handle.addEventListener('touchstart', () => { isDraggingSlider = true; });
    window.addEventListener('touchend', () => { isDraggingSlider = false; });
    window.addEventListener('touchmove', (e) => {
      if (!isDraggingSlider || !stage || !e.touches[0]) return;
      const rect = stage.getBoundingClientRect();
      const offsetX = e.touches[0].clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      updateSlider(pct);
    });

    // Buttons
    document.getElementById('btn-pm-prev')?.addEventListener('click', () => {
      renderPhoto(currentPhotoIndex - 1);
    });

    document.getElementById('btn-pm-next')?.addEventListener('click', () => {
      renderPhoto(currentPhotoIndex + 1);
    });

    document.getElementById('btn-pm-split')?.addEventListener('click', (e) => {
      setActiveViewBtn(e.target);
      stage.className = 'pm-stage split-mode';
      updateSlider(50);
    });

    document.getElementById('btn-pm-side')?.addEventListener('click', (e) => {
      setActiveViewBtn(e.target);
      stage.className = 'pm-stage side-mode';
    });

    document.getElementById('btn-pm-overlay')?.addEventListener('click', (e) => {
      setActiveViewBtn(e.target);
      stage.className = 'pm-stage overlay-mode';
      updateSlider(100);
    });

    document.getElementById('btn-pm-close-card')?.addEventListener('click', () => {
      document.getElementById('pm-sym-card')?.classList.add('hidden');
    });
  }

  function setActiveViewBtn(btn) {
    document.querySelectorAll('.pm-view-controls .pm-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  return {
    init: init,
    renderPhoto: renderPhoto
  };
})();
