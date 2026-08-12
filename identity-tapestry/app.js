// Identity Tapestry 2026 - Public Web Application
// Mount Lawley Senior High School, Years 7-12 + Staff

'use strict';

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let symbolDatabase = {};
let fullDatabaseLoaded = false;
let fullDatabasePromise = null;
let filteredSymbols = [];
let compositions = {};
let visibleCount = 40;
const SCROLL_BATCH = 40;
let isInfiniteScrollLoading = false;
let libraryViewMode = 'scan';

// Mural Generator State
let compositionElements = [];
let tankGlobalScale = 1.0;
let tankGlobalRotate = 0;
let tankPadding = 20;
let canvasWidth = 1200;
let canvasHeight = 800;
let tankBackgroundColor = "#0c0e18";
let tankForegroundColor = "#ffffff";

// ──────────────────────────────────────────────
// TAB NAVIGATION
// ──────────────────────────────────────────────
const navButtons = document.querySelectorAll('.nav-btn[data-tab]');
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
    ensureFullDatabase().then(buildMuralGallery);
  } else if (tabName === 'generator') {
    setTimeout(() => {
      resizeToContainer();
      if (compositionElements.length === 0) {
        ensureFullDatabase().then(generateRandomComposition);
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
function ensureFullDatabase() {
  if (fullDatabaseLoaded) return Promise.resolve(symbolDatabase);
  if (!fullDatabasePromise) {
    fullDatabasePromise = fetch('data.json')
      .then(r => {
        if (!r.ok) throw new Error(`Symbol database request failed: ${r.status}`);
        return r.json();
      })
      .then(data => {
        symbolDatabase = data;
        fullDatabaseLoaded = true;
        return data;
      })
      .catch(error => {
        fullDatabasePromise = null;
        throw error;
      });
  }
  return fullDatabasePromise;
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('symbols-index.json')
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

  initSiteMockupGallery();

  document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') {
      closeModal();
      closeCompositionViewer();
      closeSiteMockupLightbox();
    }

    const siteLightbox = document.getElementById('site-mockup-lightbox');
    if (siteLightbox && siteLightbox.classList.contains('active')) {
      if (e.key === 'ArrowLeft') showSiteMockup(siteMockupIndex - 1);
      if (e.key === 'ArrowRight') showSiteMockup(siteMockupIndex + 1);
      return;
    }
    
    // Handle next/prev symbol navigation with arrow keys when modal is open
    const detailModal = document.getElementById('detail-modal');
    if (detailModal && detailModal.classList.contains('active')) {
      if (e.key === 'ArrowLeft') {
        const prevBtn = document.getElementById('modal-prev-btn');
        if (prevBtn && prevBtn.style.display !== 'none') {
          prevBtn.click();
        }
      } else if (e.key === 'ArrowRight') {
        const nextBtn = document.getElementById('modal-next-btn');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextBtn.click();
        }
      }
    }
  });

  document.querySelectorAll('.library-view-btn').forEach(button => {
    button.addEventListener('click', () => setLibraryViewMode(button.dataset.libraryView));
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

  // Symbol Color Swatches listener
  const symbolSwatches = document.querySelectorAll(".symbol-swatches .symbol-swatch");
  const updateSymbolColorSelection = (color) => {
    tankForegroundColor = color;
    symbolSwatches.forEach(s => {
      if (s.getAttribute("data-color") === color) {
        s.classList.add("active");
        s.style.border = "2px solid #fff";
      } else {
        s.classList.remove("active");
        s.style.border = "1px solid rgba(255,255,255,0.2)";
      }
    });
    const canvas = document.getElementById("composition-canvas");
    if (canvas) {
      canvas.style.color = tankForegroundColor;
    }
  };

  symbolSwatches.forEach(sw => {
    sw.addEventListener("click", () => {
      updateSymbolColorSelection(sw.getAttribute("data-color"));
    });
  });

  // Background Color Swatches listener
  const swatches = document.querySelectorAll(".color-swatches .swatch");
  swatches.forEach(sw => {
    sw.addEventListener("click", () => {
      swatches.forEach(s => {
        s.classList.remove("active");
        s.style.border = "1px solid rgba(255,255,255,0.2)";
      });
      sw.classList.add("active");
      sw.style.border = "2px solid #fff";
      
      const selectedColor = sw.getAttribute("data-color");
      tankBackgroundColor = selectedColor;
      
      // Auto-contrast default suggestion
      let suggestedFore = "#ffffff";
      if (selectedColor === "#ffffff" || selectedColor === "#c0b087") {
        suggestedFore = "#0c0e18";
      }
      updateSymbolColorSelection(suggestedFore);
      
      const canvas = document.getElementById("composition-canvas");
      if (canvas) {
        canvas.style.backgroundColor = tankBackgroundColor;
        if (canvas.parentElement) {
          canvas.parentElement.style.backgroundColor = tankBackgroundColor;
        }
      }
    });
  });

  const genBtn = document.getElementById("generate-composition-btn");
  if (genBtn) {
    genBtn.addEventListener("click", () => ensureFullDatabase().then(generateRandomComposition));
  }

  const expBtn = document.getElementById("composition-export-btn");
  if (expBtn) {
    expBtn.addEventListener("click", exportCompositionSVG);
  }

  // Mobile Navigation Dropdown change listener
  const mobNav = document.getElementById("mobile-nav-dropdown");
  if (mobNav) {
    mobNav.addEventListener("change", (e) => {
      if (e.target.value === 'sphere') {
        window.location.href = 'sphere.html';
      } else {
        switchTab(e.target.value);
      }
    });
  }
});

const siteMockups = [
  { src: 'site_mockups/Assembly_01.png', caption: 'Assembly 01 · Complete site study', alt: 'Complete Identity Tapestry site assembly mockup' },
  { src: 'site_mockups/429f5596-bfc8-4a4d-a76b-1422448ca47f.png', caption: 'Yellow wall study', alt: 'Student symbols applied across a yellow school wall' },
  { src: 'site_mockups/73f40b30-8033-466e-81cb-c9eae3ff3bda.png', caption: 'Pink wall study', alt: 'Student symbols applied across a pink school wall' },
  { src: 'site_mockups/82808cf6-4e61-4767-b853-b180760fea86.png', caption: 'Ochre wall study', alt: 'Student symbols applied across an ochre school wall' },
  { src: 'site_mockups/92ddb08b-a0e9-4a54-8604-1aaa08439183.png', caption: 'Orange and turquoise wall study', alt: 'Turquoise student symbols applied across an orange school wall' },
  { src: 'site_mockups/a5b16ced-5484-414a-869f-920b7b0a1d4d.png', caption: 'Red wall study', alt: 'Student symbols applied across a red school wall' },
  { src: 'site_mockups/d5f0bac0-31ef-4dd3-ad2e-8c2d139c7ffd.png', caption: 'Blue wall study', alt: 'Student symbols applied vertically across a blue school wall' }
];
let siteMockupIndex = 0;

function initSiteMockupGallery() {
  const lightbox = document.getElementById('site-mockup-lightbox');
  if (!lightbox) return;
  document.querySelectorAll('[data-mockup-index]').forEach(button => {
    button.addEventListener('click', () => openSiteMockupLightbox(Number(button.dataset.mockupIndex)));
  });
  document.getElementById('site-lightbox-close').addEventListener('click', closeSiteMockupLightbox);
  document.getElementById('site-lightbox-prev').addEventListener('click', () => showSiteMockup(siteMockupIndex - 1));
  document.getElementById('site-lightbox-next').addEventListener('click', () => showSiteMockup(siteMockupIndex + 1));
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) closeSiteMockupLightbox();
  });
}

function openSiteMockupLightbox(index) {
  showSiteMockup(index);
  const lightbox = document.getElementById('site-mockup-lightbox');
  lightbox.classList.add('active');
  lightbox.setAttribute('aria-hidden', 'false');
  document.getElementById('site-lightbox-close').focus();
}

function showSiteMockup(index) {
  siteMockupIndex = (index + siteMockups.length) % siteMockups.length;
  const mockup = siteMockups[siteMockupIndex];
  const image = document.getElementById('site-lightbox-image');
  image.src = mockup.src;
  image.alt = mockup.alt;
  document.getElementById('site-lightbox-caption').textContent = `${mockup.caption} · ${siteMockupIndex + 1} / ${siteMockups.length}`;
}

function closeSiteMockupLightbox() {
  const lightbox = document.getElementById('site-mockup-lightbox');
  if (!lightbox) return;
  lightbox.classList.remove('active');
  lightbox.setAttribute('aria-hidden', 'true');
}

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

function setLibraryViewMode(mode) {
  if (!['scan', 'vector', 'compare'].includes(mode) || mode === libraryViewMode) return;
  libraryViewMode = mode;
  document.querySelectorAll('.library-view-btn').forEach(button => {
    const isActive = button.dataset.libraryView === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  renderLibraryGrid(false);
}

function buildLibraryVisual(sym, threshold) {
  const scan = `<img class="card-scan" src="scans/${sym.id}.jpg?v=2" alt="Source scan for student symbol #${sym.id}" loading="lazy" style="filter: contrast(${threshold}%) grayscale(100%);">`;
  const vector = `<img class="card-vector" src="svgs/${sym.id}.svg" alt="Extracted vector for student symbol #${sym.id}" loading="lazy">`;

  if (libraryViewMode === 'vector') {
    return `<div class="card-img-container card-vector-container">${vector}<span class="card-visual-label">Extracted vector</span></div>`;
  }
  if (libraryViewMode === 'compare') {
    return `
      <div class="card-img-container card-comparison">
        <div class="comparison-half">${scan}<span class="card-visual-label">Scan</span></div>
        <div class="comparison-half">${vector}<span class="card-visual-label">Vector</span></div>
      </div>`;
  }
  return `<div class="card-img-container">${scan}</div>`;
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
      ${buildLibraryVisual(sym, threshold)}
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

  // Use the same standalone vector asset as the library thumbnails. This keeps
  // each symbol's own viewBox intact and avoids loading the full database just
  // to open the comparison modal.
  const vectorContainer = document.getElementById('modal-svg-container');
  vectorContainer.style.filter = 'none';
  vectorContainer.innerHTML = `
    <img src="svgs/${sym.id}.svg?v=3" alt="Extracted vector for symbol ${sym.id}"
      style="display:block; width:100%; height:100%; object-fit:contain;" />
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

  // Next and Previous navigation logic
  const currentSymbolIndex = filteredSymbols.findIndex(s => s.id === sym.id);
  
  const prevBtn = document.getElementById('modal-prev-btn');
  if (prevBtn) {
    if (currentSymbolIndex > 0) {
      prevBtn.style.display = 'inline-flex';
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        openSymbolModal(filteredSymbols[currentSymbolIndex - 1]);
      };
    } else {
      prevBtn.style.display = 'none';
    }
  }

  const nextBtn = document.getElementById('modal-next-btn');
  if (nextBtn) {
    if (currentSymbolIndex < filteredSymbols.length - 1) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        openSymbolModal(filteredSymbols[currentSymbolIndex + 1]);
      };
    } else {
      nextBtn.style.display = 'none';
    }
  }

  // Show modal
  document.getElementById('detail-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('active');
}

function downloadSVG(sym) {
  const a = document.createElement('a');
  a.href = `svgs/${sym.id}.svg`;
  a.download = `identity_tapestry_${sym.id}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
            const S = 100 * el.scale;
            const scaleFactor = S / 1000;
            const tx = el.x + S / 2;
            const ty = el.y + S / 2;
            svgThumb += `<path d="${sym.svg_path_data}" transform="translate(${tx}, ${ty}) scale(${scaleFactor}) rotate(${el.rotation})" fill="#ffffff" opacity="0.85" />`;
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
      <svg viewBox="-500 -500 1000 1000" width="100%" height="100%">
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

  const edgePadding = 20;
  selectedSymbols.forEach((sym, idx) => {
    let scale = baseScale * (0.6 + Math.random() * 0.8);
    // Assign an independent rotation weight between -1.0 and 1.0
    let rotWeight = Math.random() * 2.0 - 1.0;
    const radius = 50 * scale + edgePadding;

    let x = radius + Math.random() * (w - 2 * radius);
    let y = radius + Math.random() * (h - 2 * radius);

    elements.push({
      id: sym.id,
      x: Math.round(x),
      y: Math.round(y),
      scale: parseFloat(scale.toFixed(2)),
      rotWeight: parseFloat(rotWeight.toFixed(3)),
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
    // 1. Pairwise separation
    for (let i = 0; i < numElements; i++) {
      const elA = compositionElements[i];
      const radiusA = baseRadius * elA.scale * tankGlobalScale;
      const cxA = elA.x;
      const cyA = elA.y;

      for (let j = i + 1; j < numElements; j++) {
        const elB = compositionElements[j];
        const radiusB = baseRadius * elB.scale * tankGlobalScale;
        const cxB = elB.x;
        const cyB = elB.y;

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

    // 2. Boundary lock
    const edgePadding = 20;
    compositionElements.forEach(el => {
      const radius = baseRadius * el.scale * tankGlobalScale + edgePadding;
      if (el.x < radius) el.x = radius;
      else if (el.x > canvasWidth - radius) el.x = canvasWidth - radius;
      if (el.y < radius) el.y = radius;
      else if (el.y > canvasHeight - radius) el.y = canvasHeight - radius;
    });
  }
  renderCanvas();
}

function renderCanvas() {
  const canvas = document.getElementById("composition-canvas");
  if (!canvas) return;

  const divs = canvas.querySelectorAll(".placed-symbol");

  const applyStyle = (div, el) => {
    const visScale = el.scale * tankGlobalScale;
    const visRotation = (el.rotWeight !== undefined) ? 
      (el.rotWeight * tankGlobalRotate) : 
      (el.rotation + tankGlobalRotate);
    const currentSize = 100 * visScale;

    div.style.position = 'absolute';
    div.style.width = `${currentSize}px`;
    div.style.height = `${currentSize}px`;
    div.style.left = `${el.x - currentSize / 2}px`;
    div.style.top = `${el.y - currentSize / 2}px`;
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
        <svg viewBox="-500 -500 1000 1000" width="100%" height="100%">
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

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background-color: ${tankBackgroundColor};">\n`;
  svgContent += `  <!-- Background -->\n  <rect width="100%" height="100%" fill="${tankBackgroundColor}" />\n\n`;

  const sortedElements = [...compositionElements].sort((a, b) => a.zIndex - b.zIndex);

  sortedElements.forEach(el => {
    const sym = symbolDatabase[el.id + ".png"];
    if (sym) {
      const finalScale = el.scale * tankGlobalScale;
      const finalRotation = (el.rotWeight !== undefined) ? 
        Math.round(el.rotWeight * tankGlobalRotate) : 
        (el.rotation + tankGlobalRotate);
      const S = 100 * finalScale;
      const scaleFactor = S / 1000;
      const tx = el.x + S / 2;
      const ty = el.y + S / 2;
      svgContent += `  <!-- Symbol #${el.id} -->\n`;
      svgContent += `  <path d="${sym.svg_path_data}" transform="translate(${tx}, ${ty}) scale(${scaleFactor}) rotate(${finalRotation})" fill="${tankForegroundColor}" stroke="none" />\n`;
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
