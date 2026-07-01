// Identity Tapestry 2026 - Public Web Application
// Mount Lawley Senior High School, Years 7-12 + Staff

'use strict';

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let symbolDatabase = {};
let filteredSymbols = [];
let compositions = {};
let visibleCount = 40;
const SCROLL_BATCH = 40;
let isInfiniteScrollLoading = false;

// Mural Generator State
let compositionElements = [];
let tankGlobalScale = 1.0;
let tankGlobalRotate = 0;
let tankPadding = 20;
let canvasWidth = 1200;
let canvasHeight = 800;

// ──────────────────────────────────────────────
// TAB NAVIGATION
// ──────────────────────────────────────────────
const navButtons = document.querySelectorAll('.nav-btn');
const tabPanels  = document.querySelectorAll('.tab-panel');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

function switchTab(tabName) {
  navButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
  tabPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${tabName}`));
  
  // Sync the mobile dropdown selector if present
  const mobileSelect = document.getElementById('mobile-nav-dropdown');
  if (mobileSelect) {
    mobileSelect.value = tabName;
  }

  // Reset scroll position on tab switch
  const scrollContainer = document.querySelector('.app-main');
  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
  }

  // Hide scroll-to-top button on tab switch
  const scrollTopBtn = document.getElementById('scroll-to-top-btn');
  if (scrollTopBtn) {
    scrollTopBtn.classList.remove('visible');
  }

  if (tabName === 'gallery') {
    buildMuralGallery();
  } else if (tabName === 'generator') {
    setTimeout(() => {
      resizeToContainer();
      if (compositionElements.length === 0) {
        generateRandomComposition();
      }
    }, 100);
  } else if (tabName === 'library') {
    setTimeout(checkAndLoadMoreIfNeeded, 100);
  }
}

// Expose for inline onclick in manifesto buttons
window.switchTab = switchTab;

// ──────────────────────────────────────────────
// BOOTSTRAP: load data.json then wire everything
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fetch('data.json')
    .then(r => r.json())
    .then(data => {
      symbolDatabase = data;
      updateManifestoStats();
      buildVisualLibrary();
    })
    .catch(err => {
      console.error('Could not load symbol database:', err);
      document.getElementById('symbols-grid').innerHTML =
        '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">Could not load the symbol library. Please try again later.</div>';
    });

  // Modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target.id === 'detail-modal') closeModal();
  });
  
  // Composition modal close
  document.getElementById('compo-modal-close-btn').addEventListener('click', closeCompositionViewer);
  document.getElementById('composition-modal').addEventListener('click', e => {
    if (e.target.id === 'composition-modal') closeCompositionViewer();
  });

  document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') {
      closeModal();
      closeCompositionViewer();
    }
  });

  // Infinite scroll
  initInfiniteScroll();

  // Resize listener for active composition overlay
  window.addEventListener('resize', () => {
    const compoModal = document.getElementById('composition-modal');
    if (compoModal && compoModal.classList.contains('active')) {
      applyPublicCanvasZoomFit(1200, 800);
    }
    // Also resize generator canvas if tab is active
    const genPanel = document.getElementById('panel-generator');
    if (genPanel && genPanel.classList.contains('active')) {
      resizeToContainer();
    }
  });

  // Generator Range Controls & Buttons
  const countSlider = document.getElementById("player-symbol-count");
  if (countSlider) {
    countSlider.addEventListener("input", (e) => {
      document.getElementById("player-symbol-count-val").innerText = e.target.value;
    });
  }

  const paddingSlider = document.getElementById("tank-padding");
  if (paddingSlider) {
    paddingSlider.addEventListener("input", (e) => {
      tankPadding = parseInt(e.target.value);
      document.getElementById("tank-padding-val").innerText = `${tankPadding}px`;
      stepPhysicsOnce(20);
    });
  }

  const scaleSlider = document.getElementById("tank-global-scale");
  if (scaleSlider) {
    scaleSlider.addEventListener("input", (e) => {
      tankGlobalScale = parseFloat(e.target.value);
      document.getElementById("tank-global-scale-val").innerText = `${tankGlobalScale}x`;
      stepPhysicsOnce(20);
    });
  }

  const rotateSlider = document.getElementById("tank-global-rotate");
  if (rotateSlider) {
    rotateSlider.addEventListener("input", (e) => {
      tankGlobalRotate = parseInt(e.target.value);
      document.getElementById("tank-global-rotate-val").innerText = `${tankGlobalRotate}°`;
      renderCanvas();
    });
  }

  const genBtn = document.getElementById("generate-composition-btn");
  if (genBtn) {
    genBtn.addEventListener("click", generateRandomComposition);
  }

  const expBtn = document.getElementById("composition-export-btn");
  if (expBtn) {
    expBtn.addEventListener("click", exportCompositionSVG);
  }

  // Mobile Navigation Dropdown change listener
  const mobNav = document.getElementById("mobile-nav-dropdown");
  if (mobNav) {
    mobNav.addEventListener("change", (e) => {
      switchTab(e.target.value);
    });
  }
});

// ──────────────────────────────────────────────
// MANIFESTO STATISTICS
// ──────────────────────────────────────────────
function updateManifestoStats() {
  const unique = Object.values(symbolDatabase).filter(s => !s.deleted && s.duplicate_of === null);

  // Header badge
  const badge = document.getElementById('stats-total-badge');
  if (badge) badge.innerText = `${unique.length} Drawings`;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

  setEl('m-stat-total', unique.length);
  setEl('m-stat-participants', 'Yrs 7-12 + Staff');
}

// ──────────────────────────────────────────────
// VISUAL LIBRARY: render unique grid
// ──────────────────────────────────────────────
function buildVisualLibrary() {
  let result = Object.values(symbolDatabase).filter(s => !s.deleted && s.duplicate_of === null && s.visible !== false);
  result.sort((a, b) => a.id.localeCompare(b.id));

  filteredSymbols = result;
  visibleCount = SCROLL_BATCH;
  renderLibraryGrid(false);
}

function renderLibraryGrid(append = false) {
  const grid       = document.getElementById('symbols-grid');
  const countLabel = document.getElementById('result-count-label');
  const loadedLbl  = document.getElementById('loaded-count-label');
  const spinner    = document.getElementById('infinite-scroll-spinner');
  const endMsg     = document.getElementById('infinite-scroll-end');

  if (!append) grid.innerHTML = '';

  const total = filteredSymbols.length;
  countLabel.innerText = `Showing ${total} designs`;

  if (total === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">No symbols found.</div>';
    loadedLbl.innerText = 'Loaded 0 / 0';
    spinner.style.display = 'none';
    endMsg.style.display  = 'none';
    return;
  }

  const startIdx = append ? grid.children.length : 0;
  const endIdx   = Math.min(visibleCount, total);
  loadedLbl.innerText = `Loaded ${endIdx} / ${total}`;

  for (let i = startIdx; i < endIdx; i++) {
    const sym  = filteredSymbols[i];
    const card = document.createElement('div');
    card.className = 'symbol-card';

    // Apply the custom contrast filter if set
    const threshold = sym.threshold !== undefined ? sym.threshold : 100;

    card.innerHTML = `
      <div class="card-img-container" style="background:#fff;">
        <img src="scans/${sym.id}.jpg" alt="Student symbol #${sym.id}" loading="lazy" style="filter: contrast(${threshold}%) grayscale(100%);">
      </div>
      <div class="card-info" style="justify-content:center;">
        <span class="card-id">#${sym.id}</span>
      </div>
    `;

    card.addEventListener('click', () => openSymbolModal(sym));
    grid.appendChild(card);
  }

  const allLoaded = endIdx >= total;
  spinner.style.display = 'none';
  endMsg.style.display  = allLoaded && total > 12 ? 'block' : 'none';

  // Auto-load next batch if screen height is larger than loaded content height
  if (!allLoaded) {
    setTimeout(checkAndLoadMoreIfNeeded, 100);
  }
}

function checkAndLoadMoreIfNeeded() {
  const libraryPanel = document.getElementById('panel-library');
  if (!libraryPanel || !libraryPanel.classList.contains('active')) return;
  const scrollContainer = document.querySelector('.app-main');
  if (!scrollContainer) return;
  const hasScrollbar = scrollContainer.scrollHeight > scrollContainer.clientHeight;
  if (!hasScrollbar && visibleCount < filteredSymbols.length) {
    visibleCount += SCROLL_BATCH;
    renderLibraryGrid(true);
  }
}

// ──────────────────────────────────────────────
// INFINITE SCROLL
// ──────────────────────────────────────────────
function initInfiniteScroll() {
  const scrollContainer = document.querySelector('.app-main');
  if (!scrollContainer) return;

  const scrollTopBtn = document.getElementById('scroll-to-top-btn');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  scrollContainer.addEventListener('scroll', () => {
    const libraryPanel = document.getElementById('panel-library');
    if (libraryPanel && libraryPanel.classList.contains('active')) {
      if (scrollTopBtn) {
        scrollTopBtn.classList.toggle('visible', scrollContainer.scrollTop > 300);
      }
    }

    if (!libraryPanel || !libraryPanel.classList.contains('active')) return;

    const nearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
    if (nearBottom && !isInfiniteScrollLoading && visibleCount < filteredSymbols.length) {
      isInfiniteScrollLoading = true;
      document.getElementById('infinite-scroll-spinner').style.display = 'flex';
      setTimeout(() => {
        visibleCount += SCROLL_BATCH;
        renderLibraryGrid(true);
        isInfiniteScrollLoading = false;
        document.getElementById('infinite-scroll-spinner').style.display = 'none';
      }, 200);
    }
  });
}

// ──────────────────────────────────────────────
// SYMBOL MODAL: read-only
// ──────────────────────────────────────────────
function openSymbolModal(sym) {
  document.getElementById('modal-id').innerText = sym.id;

  // Use the optimized JPEG raw scan drawing
  const origImg = document.getElementById('modal-img-original');
  origImg.src = 'scans/' + sym.id + '.jpg';
  origImg.onerror = () => {
    origImg.src = sym.png_path; // fallback
  };

  // Apply custom threshold (contrast) filter
  const threshold = sym.threshold !== undefined ? sym.threshold : 100;
  origImg.style.filter = `contrast(${threshold}%) grayscale(100%)`;
  document.getElementById('modal-svg-container').style.filter = `contrast(${threshold}%)`;

  // Inline SVG vector
  document.getElementById('modal-svg-container').innerHTML = `
    <svg viewBox="0 0 3024 3024" width="100%" height="100%">
      <path d="${sym.svg_path_data}" fill="currentColor" stroke="none" />
    </svg>
  `;

  // Curatorial notes
  const notesText = sym.notes || "";
  const notesSec = document.getElementById('modal-notes-section');
  const notesEl = document.getElementById('modal-notes-text');
  if (notesText && notesSec && notesEl) {
    notesEl.innerText = notesText;
    notesSec.style.display = 'block';
  } else if (notesSec) {
    notesSec.style.display = 'none';
  }

  // Download SVG button
  document.getElementById('download-svg-btn').onclick = () => downloadSVG(sym);

  // Show modal
  document.getElementById('detail-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('active');
}

function downloadSVG(sym) {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3024 3024" width="3024" height="3024">
  <rect width="3024" height="3024" fill="#0c0e18"/>
  <path d="${sym.svg_path_data}" fill="#ffffff" stroke="none"/>
</svg>`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `identity_tapestry_${sym.id}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// MURAL GALLERY BUILD & RENDERING
// ──────────────────────────────────────────────
function buildMuralGallery() {
  const grid = document.getElementById('public-compositions-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Loading gallery...</div>';

  fetch('compositions.json')
    .then(r => r.json())
    .then(data => {
      compositions = data;
      const names = Object.keys(compositions);
      if (names.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">No composition layouts published yet.</div>';
        return;
      }

      grid.innerHTML = '';
      names.forEach(name => {
        const elements = compositions[name];
        const card = document.createElement('div');
        card.className = 'symbol-card';
        card.style.cursor = 'pointer';
        card.style.width = '100%';

        // Generate tiny SVG thumbnail representing the collage layout
        let svgThumb = `<svg viewBox="0 0 1200 800" style="width:100%; aspect-ratio:1.5; background:#0c0e18; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.05);">`;
        elements.forEach(el => {
          const sym = symbolDatabase[el.id + '.png'];
          if (sym) {
            const scaleFactor = el.scale * (100 / 3024);
            svgThumb += `<path d="${sym.svg_path_data}" transform="translate(${el.x}, ${el.y}) scale(${scaleFactor}) rotate(${el.rotation}, 1512, 1512)" fill="#ffffff" opacity="0.85" />`;
          }
        });
        svgThumb += `</svg>`;

        card.innerHTML = `
          ${svgThumb}
          <div class="card-info" style="justify-content:center;">
            <span class="card-id" style="font-size:0.95rem;">${name}</span>
          </div>
        `;

        card.addEventListener('click', () => openCompositionViewer(name, elements));
        grid.appendChild(card);
      });
    })
    .catch(err => {
      console.warn('compositions.json not found or empty:', err);
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">No composition layouts published yet.</div>';
    });
}

function openCompositionViewer(name, elements) {
  const canvas = document.getElementById('public-view-canvas');
  if (!canvas) return;

  canvas.innerHTML = '';
  const w = 1200;
  const h = 800;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  // Render elements in composition
  elements.forEach(el => {
    const sym = symbolDatabase[el.id + '.png'];
    if (!sym) return;

    const div = document.createElement('div');
    div.className = 'placed-symbol';
    div.style.position = 'absolute';
    
    // Scale and rotate
    const size = 100 * el.scale;
    const half = size / 2;
    const cx = el.x + (100 * el.scale) / 2;
    const cy = el.y + (100 * el.scale) / 2;

    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.left = `${cx - half}px`;
    div.style.top = `${cy - half}px`;
    div.style.transform = `rotate(${el.rotation}deg)`;
    div.style.zIndex = el.zIndex;
    div.style.transformOrigin = 'center center';

    div.innerHTML = `
      <svg viewBox="0 0 3024 3024" width="100%" height="100%">
        <path d="${sym.svg_path_data}" fill="currentColor" stroke="none" />
      </svg>
    `;
    canvas.appendChild(div);
  });

  // Apply zoom fit
  applyPublicCanvasZoomFit(w, h);

  // Show modal
  document.getElementById('composition-modal').classList.add('active');
}

function closeCompositionViewer() {
  document.getElementById('composition-modal').classList.remove('active');
}

function applyPublicCanvasZoomFit(w, h) {
  const container = document.querySelector('#composition-modal .canvas-container');
  const canvas = document.getElementById('public-view-canvas');
  if (!container || !canvas) return;

  const pad = 40;
  const availW = container.clientWidth - pad;
  const availH = container.clientHeight - pad;

  const scaleX = availW / w;
  const scaleY = availH / h;
  const fitScale = Math.min(1.0, scaleX, scaleY);

  canvas.style.transform = `scale(${fitScale})`;
}

// ──────────────────────────────────────────────
// MURAL GENERATOR LOGIC
// ──────────────────────────────────────────────
function resizeVirtualCanvas(w, h) {
  canvasWidth = w;
  canvasHeight = h;
  const canvas = document.getElementById("composition-canvas");
  if (canvas) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
}

function resizeToContainer() {
  const container = document.querySelector(".canvas-container");
  if (!container) return;
  const w = Math.max(400, container.clientWidth - 2);
  const h = Math.max(400, container.clientHeight - 2);
  resizeVirtualCanvas(w, h);
}

function generateRandomComposition() {
  let activeSymbols = Object.values(symbolDatabase).filter(s => s.duplicate_of === null && !s.deleted && s.visible !== false);
  if (activeSymbols.length === 0) return;

  const countSlider = document.getElementById("player-symbol-count");
  const maxCount = countSlider ? parseInt(countSlider.value) : 30;
  // Choose random count up to slider limit
  const count = Math.floor(Math.random() * (maxCount - 5 + 1)) + 5;

  const paddingSlider = document.getElementById("tank-padding");
  if (paddingSlider) {
    tankPadding = parseInt(paddingSlider.value);
  }

  // Shuffle and slice to select unique symbols
  const shuffled = activeSymbols.sort(() => 0.5 - Math.random());
  const selectedSymbols = shuffled.slice(0, Math.min(count, shuffled.length));

  const w = canvasWidth;
  const h = canvasHeight;
  const elements = [];

  const scaleSlider = document.getElementById("tank-global-scale");
  const baseScale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;

  const rotateSlider = document.getElementById("tank-global-rotate");
  const baseRotate = rotateSlider ? parseInt(rotateSlider.value) : 0;

  selectedSymbols.forEach((sym, idx) => {
    let x = 80 + Math.random() * (w - 200);
    let y = 80 + Math.random() * (h - 200);
    let scale = baseScale * (0.6 + Math.random() * 0.8);
    let rotation = (baseRotate + Math.floor(Math.random() * 360)) % 360;

    const size = 100 * scale;
    if (x < 40) x = 40;
    else if (x + size > w - 40) x = w - 40 - size;
    if (y < 40) y = 40;
    else if (y + size > h - 40) y = h - 40 - size;

    elements.push({
      id: sym.id,
      x: Math.round(x),
      y: Math.round(y),
      scale: parseFloat(scale.toFixed(2)),
      rotation: rotation,
      zIndex: idx + 1
    });
  });

  compositionElements = elements;

  // Settle elements using physics: 100 passes guarantees no overlap
  stepPhysicsOnce(100);
}

function stepPhysicsOnce(customIterations) {
  const numElements = compositionElements.length;
  const baseRadius = 50;
  const iterations = typeof customIterations === "number" ? customIterations : 20;
  
  for (let iter = 0; iter < iterations; iter++) {
    // Boundary lock
    compositionElements.forEach(el => {
      const visScale = el.scale * tankGlobalScale;
      const size = 100 * visScale;
      if (el.x < 0) el.x = 0;
      else if (el.x + size > canvasWidth) el.x = canvasWidth - size;
      if (el.y < 0) el.y = 0;
      else if (el.y + size > canvasHeight) el.y = canvasHeight - size;
    });

    // Pairwise separation
    for (let i = 0; i < numElements; i++) {
      const elA = compositionElements[i];
      const radiusA = baseRadius * elA.scale * tankGlobalScale;
      const cxA = elA.x + radiusA;
      const cyA = elA.y + radiusA;

      for (let j = i + 1; j < numElements; j++) {
        const elB = compositionElements[j];
        const radiusB = baseRadius * elB.scale * tankGlobalScale;
        const cxB = elB.x + radiusB;
        const cyB = elB.y + radiusB;

        const dx = cxB - cxA;
        const dy = cyB - cyA;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = radiusA + radiusB + tankPadding;

        if (dist < minDist) {
          const overlap = minDist - dist;
          let pushX = 0.5;
          let pushY = 0.5;
          if (dist > 0) {
            pushX = (dx / dist) * overlap * 0.5;
            pushY = (dy / dist) * overlap * 0.5;
          } else {
            const angle = Math.random() * Math.PI * 2;
            pushX = Math.cos(angle) * overlap * 0.5;
            pushY = Math.sin(angle) * overlap * 0.5;
          }
          elA.x -= pushX;
          elA.y -= pushY;
          elB.x += pushX;
          elB.y += pushY;
        }
      }
    }
  }
  renderCanvas();
}

function renderCanvas() {
  const canvas = document.getElementById("composition-canvas");
  if (!canvas) return;

  const divs = canvas.querySelectorAll(".placed-symbol");

  const applyStyle = (div, el) => {
    const visScale = el.scale * tankGlobalScale;
    const visRotation = el.rotation + tankGlobalRotate;
    const baseSize = 100;
    const currentSize = baseSize * visScale;
    const halfSize = currentSize / 2;

    const cx = el.x + (baseSize * el.scale) / 2;
    const cy = el.y + (baseSize * el.scale) / 2;

    div.style.position = 'absolute';
    div.style.width = `${currentSize}px`;
    div.style.height = `${currentSize}px`;
    div.style.left = `${cx - halfSize}px`;
    div.style.top = `${cy - halfSize}px`;
    div.style.transform = `rotate(${visRotation}deg)`;
    div.style.zIndex = el.zIndex;
    div.style.transformOrigin = 'center center';
  };

  if (divs.length === compositionElements.length) {
    compositionElements.forEach((el, idx) => applyStyle(divs[idx], el));
  } else {
    divs.forEach(s => s.remove());
    compositionElements.forEach((el) => {
      const sym = symbolDatabase[el.id + ".png"];
      if (!sym) return;

      const div = document.createElement("div");
      div.className = "placed-symbol";
      applyStyle(div, el);

      div.innerHTML = `
        <svg viewBox="0 0 3024 3024" width="100%" height="100%">
          <path d="${sym.svg_path_data}" fill="currentColor" stroke="none" />
        </svg>
      `;
      canvas.appendChild(div);
    });
  }
}

function exportCompositionSVG() {
  if (compositionElements.length === 0) {
    alert("Canvas is empty! Generate a composition layout first.");
    return;
  }

  const w = canvasWidth;
  const h = canvasHeight;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background-color: #0c0e18;">\n`;
  svgContent += `  <!-- Background -->\n  <rect width="100%" height="100%" fill="#0c0e18" />\n\n`;

  const sortedElements = [...compositionElements].sort((a, b) => a.zIndex - b.zIndex);

  sortedElements.forEach(el => {
    const sym = symbolDatabase[el.id + ".png"];
    if (sym) {
      const finalScale = el.scale * tankGlobalScale;
      const finalRotation = el.rotation + tankGlobalRotate;
      const scaleFactor = finalScale * (100 / 3024);
      svgContent += `  <!-- Symbol #${el.id} -->\n`;
      svgContent += `  <path d="${sym.svg_path_data}" transform="translate(${el.x}, ${el.y}) scale(${scaleFactor}) rotate(${finalRotation}, 1512, 1512)" fill="#ffffff" stroke="none" />\n`;
    }
  });

  svgContent += `</svg>`;

  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mural_composition_${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
