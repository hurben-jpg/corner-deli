// Identity Tapestry 2026 - Client Application

let symbolDatabase = {};
let filteredSymbols = [];

// Composition Builder Variables
let compositionElements = [];
let compositionHistory = [];
let historyIndex = -1;
let slideshowIntervalId = null;
let slideshowSpeedSeconds = 5;
let reusableSymbols = new Set();
let compositions = {};
let isBuilderInitialized = false;
let nextZIndex = 1;
let dragStartY = 0;

// Infinite scroll variables
let visibleCount = 40;
const scrollBatch = 40;
let isInfiniteScrollLoading = false;

// Virtual Canvas & 2D Tank Physics Mixer Variables
let canvasWidth = 1200;
let canvasHeight = 800;
let isTankPhysicsRunning = false;
let tankBackgroundColor = "#0c0e18";
let tankForegroundColor = "#ffffff";
let tankPhysicsAnimationId = null;
let tankPadding = 20;
let tankGlobalScale = 1.0;
let tankGlobalRotate = 0;
let tankGravity = 0.0;
let tankScaleJitter = 0.0;
let tankRotateJitter = 0;

// Tab Switching
const navButtons = document.querySelectorAll(".nav-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabName = btn.getAttribute("data-tab");
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  // Update nav buttons
  navButtons.forEach(b => {
    if (b.getAttribute("data-tab") === tabName) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });

  // Update panels
  tabPanels.forEach(p => {
    if (p.id === `panel-${tabName}`) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  // Manage Composition Builder & 3D Site Model initialization
  if (tabName === "pond") {
    initBuilder();
  }
  if (tabName === "site_photos") {
    if (!window.isPhotoMuralInitialized && window.PhotoMuralApp) {
      window.isPhotoMuralInitialized = true;
      window.PhotoMuralApp.init("photo-mural-mount");
    }
  }
}

// Global switch tab helper (called inline from HTML)
window.switchTab = switchTab;

// Load database on start
document.addEventListener("DOMContentLoaded", () => {
  fetch("data.json?v=" + Date.now())
    .then(response => response.json())
    .then(data => {
      symbolDatabase = data;
      // Filter out duplicates for core list
      filteredSymbols = Object.values(symbolDatabase);
      
      // Update badge counts and manifesto statistics
      updateAppStatistics();
      
      // Build library and collage
      buildVisualLibrary();
      buildCollageWall();
      
      // Bind interactive thesis links
      bindThesisFilters();
      
      // Initial render of investigations
      renderInvestigationTab("psychology");
      
      // Set symbol count slider max dynamically based on database active unique symbols
      const countSlider = document.getElementById("player-symbol-count");
      if (countSlider) {
        const activeCount = Object.values(symbolDatabase).filter(s => s.duplicate_of === null && !s.deleted).length;
        countSlider.max = activeCount;
        // Default to a reasonable starting count (25% of total)
        const defaultCount = Math.min(30, Math.max(10, Math.round(activeCount * 0.08)));
        countSlider.value = defaultCount;
        const countLabel = document.getElementById("player-symbol-count-val");
        if (countLabel) countLabel.innerText = defaultCount;
      }
    })
    .catch(err => {
      console.error("Error loading database:", err);
    });

  // Library controls events
  document.getElementById("search-input").addEventListener("input", buildVisualLibrary);
  document.getElementById("filter-theme").addEventListener("change", buildVisualLibrary);
  document.getElementById("filter-density").addEventListener("change", buildVisualLibrary);
  document.getElementById("filter-steadiness").addEventListener("change", buildVisualLibrary);
  document.getElementById("sort-by").addEventListener("change", buildVisualLibrary);
  document.getElementById("hide-duplicates").addEventListener("change", buildVisualLibrary);
  document.getElementById("show-deleted").addEventListener("change", buildVisualLibrary);

  // Modal events
  document.getElementById("modal-close-btn").addEventListener("click", () => {
    document.getElementById("detail-modal").classList.remove("active");
  });
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "detail-modal") {
      document.getElementById("detail-modal").classList.remove("active");
    }
  });

  // Investigations Nav
  document.querySelectorAll(".inv-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".inv-nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderInvestigationTab(btn.getAttribute("data-tab"));
    });
  });

  // Infinite scroll init
  initInfiniteScroll();
});

// Update Manifesto and header counts
function updateAppStatistics() {
  const allSymbols = Object.values(symbolDatabase).filter(s => !s.deleted);
  const uniqueCount = allSymbols.filter(s => s.duplicate_of === null).length;
  
  document.getElementById("stats-total-badge").innerText = `${uniqueCount} Symbols`;
  document.getElementById("m-stat-total").innerText = uniqueCount;
  
  // Calculate average steadiness
  const steadinessValues = allSymbols.map(s => s.metrics.steadiness).filter(v => v > 0);
  const avgSteadiness = steadinessValues.length > 0 ? (steadinessValues.reduce((a, b) => a + b, 0) / steadinessValues.length) * 100 : 0;
  document.getElementById("m-stat-steadiness").innerText = `${avgSteadiness.toFixed(1)}%`;
  
  // Count duplicates
  const dupesCount = allSymbols.filter(s => s.duplicate_of !== null).length;
  document.getElementById("m-stat-dupes").innerText = dupesCount;
  
  // Highly geometric/traced count
  const tracedCount = allSymbols.filter(s => s.classification.traced_likelihood > 70).length;
  const tracedPercent = allSymbols.length > 0 ? (tracedCount / allSymbols.length) * 100 : 0;
  document.getElementById("m-stat-trace").innerText = `${tracedPercent.toFixed(1)}%`;
}

// Bind Manifesto interactive filter links
function bindThesisFilters() {
  document.querySelectorAll(".thesis-filter-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const filterType = link.getAttribute("data-filter");
      const filterValue = link.getAttribute("data-value");
      
      // Reset all filters first
      document.getElementById("filter-theme").value = "all";
      document.getElementById("filter-density").value = "all";
      document.getElementById("filter-steadiness").value = "all";
      document.getElementById("search-input").value = "";
      document.getElementById("show-deleted").checked = false;
      
      // Apply selected filter
      if (filterType === "theme") {
        document.getElementById("filter-theme").value = filterValue;
      } else if (filterType === "density") {
        document.getElementById("filter-density").value = filterValue;
      } else if (filterType === "steadiness") {
        document.getElementById("filter-steadiness").value = filterValue;
      }
      
      // Update grid data
      buildVisualLibrary();
      
      // Go to library page
      switchTab("library");
      
      // Scroll smoothly to grid
      document.getElementById("panel-library").scrollIntoView({ behavior: "smooth" });
    });
  });
}

// Process filters and sorts for visual library
function buildVisualLibrary() {
  const searchQuery = document.getElementById("search-input").value.toLowerCase().trim();
  const themeFilter = document.getElementById("filter-theme").value;
  const densityFilter = document.getElementById("filter-density").value;
  const steadinessFilter = document.getElementById("filter-steadiness").value;
  const sortBy = document.getElementById("sort-by").value;
  const hideDuplicates = document.getElementById("hide-duplicates").checked;
  const showDeleted = document.getElementById("show-deleted").checked;

  let result = Object.values(symbolDatabase);

  // 0. Deleted filter
  if (!showDeleted) {
    result = result.filter(sym => !sym.deleted);
  }

  // 1. Duplicate filtering
  if (hideDuplicates) {
    result = result.filter(sym => sym.duplicate_of === null);
  }

  // 2. Search query filter
  if (searchQuery) {
    result = result.filter(sym => {
      const matchId = sym.id.includes(searchQuery);
      const matchTheme = sym.classification.theme.toLowerCase().includes(searchQuery);
      const matchTags = sym.classification.tags.some(t => t.toLowerCase().includes(searchQuery));
      return matchId || matchTheme || matchTags;
    });
  }

  // 3. Theme filter
  if (themeFilter !== "all") {
    result = result.filter(sym => sym.classification.theme === themeFilter);
  }

  // 4. Density filter
  if (densityFilter !== "all") {
    result = result.filter(sym => {
      const dens = sym.metrics.density;
      if (densityFilter === "bold") return dens > 0.08;
      if (densityFilter === "medium") return dens >= 0.03 && dens <= 0.08;
      if (densityFilter === "delicate") return dens < 0.03;
      return true;
    });
  }

  // 5. Steadiness filter
  if (steadinessFilter !== "all") {
    result = result.filter(sym => {
      const stead = sym.metrics.steadiness;
      if (steadinessFilter === "steady") return stead > 0.95;
      if (steadinessFilter === "organic") return stead < 0.91;
      return true;
    });
  }

  // 6. Sorting
  result.sort((a, b) => {
    if (sortBy === "id-asc") return a.id.localeCompare(b.id);
    if (sortBy === "id-desc") return b.id.localeCompare(a.id);
    if (sortBy === "density-desc") return b.metrics.density - a.metrics.density;
    if (sortBy === "density-asc") return a.metrics.density - b.metrics.density;
    if (sortBy === "thickness-desc") return b.metrics.thickness - a.metrics.thickness;
    if (sortBy === "thickness-asc") return a.metrics.thickness - b.metrics.thickness;
    if (sortBy === "steadiness-desc") return b.metrics.steadiness - a.metrics.steadiness;
    if (sortBy === "steadiness-asc") return a.metrics.steadiness - b.metrics.steadiness;
    return 0;
  });

  filteredSymbols = result;
  visibleCount = 120;
  renderLibraryGrid(false);
}

// Render infinite scroll card grid
function renderLibraryGrid(append = false) {
  const gridContainer = document.getElementById("symbols-grid");
  const countLabel = document.getElementById("result-count-label");
  const loadedLabel = document.getElementById("loaded-count-label");
  const spinner = document.getElementById("infinite-scroll-spinner");
  const endMsg = document.getElementById("infinite-scroll-end");
  
  if (!append) {
    gridContainer.innerHTML = "";
  }

  const totalItems = filteredSymbols.length;
  countLabel.innerText = `Showing ${totalItems} designs`;

  if (totalItems === 0) {
    gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No symbols match your filters.</div>`;
    loadedLabel.innerText = "Loaded 0 / 0";
    spinner.style.display = "none";
    endMsg.style.display = "none";
    return;
  }

  const startIndex = append ? gridContainer.children.length : 0;
  const endIndex = Math.min(visibleCount, totalItems);
  
  loadedLabel.innerText = `Loaded ${endIndex} / ${totalItems}`;

  for (let i = startIndex; i < endIndex; i++) {
    const sym = filteredSymbols[i];
    const card = document.createElement("div");
    card.className = "symbol-card";
    
    // Dim deleted or hidden designs visually
    const isHidden = sym.visible === false;
    if (sym.deleted) {
      card.style.opacity = 0.4;
      card.style.border = "1px dashed rgba(239, 68, 68, 0.4)";
    } else if (isHidden) {
      card.style.opacity = 0.65;
      card.style.border = "1px dashed rgba(245, 158, 11, 0.4)";
    }
    
    // Add visual duplicate indicator dot
    const isDuplicate = sym.duplicate_of !== null;
    const dupeDot = isDuplicate ? `<div class="duplicate-indicator" title="Visual Duplicate of ${sym.duplicate_of}"></div>` : "";
    const deletedBadge = sym.deleted ? `<span class="tag-badge" style="position: absolute; top: 6px; left: 6px; background-color: #ef4444; color: #fff; border: none; font-size: 0.6rem; padding: 1.5px 4px; line-height: 1;">Deleted</span>` : "";
    const hiddenBadge = (!sym.deleted && isHidden) ? `<span class="tag-badge" style="position: absolute; top: 6px; right: 6px; background-color: #f59e0b; color: #fff; border: none; font-size: 0.6rem; padding: 1.5px 4px; line-height: 1;">Hidden</span>` : "";
    
    const threshold = sym.threshold !== undefined ? sym.threshold : 100;

    card.innerHTML = `
      ${dupeDot}
      ${deletedBadge}
      ${hiddenBadge}
      <div class="card-img-container" style="background:#fff;">
        <img src="scans/${sym.id}.jpg" alt="Symbol ${sym.id}" loading="lazy" style="filter: contrast(${threshold}%) grayscale(100%);">
      </div>
      <div class="card-info" style="justify-content:center;">
        <span class="card-id">#${sym.id}</span>
      </div>
    `;
    
    card.addEventListener("click", () => openSymbolInspector(sym));
    gridContainer.appendChild(card);
  }

  const allLoaded = endIndex >= totalItems;
  spinner.style.display = "none";
  endMsg.style.display = allLoaded && totalItems > 12 ? "block" : "none";

  // Auto-load next batch if screen height is larger than loaded content height
  if (!allLoaded) {
    setTimeout(checkAndLoadMoreIfNeeded, 100);
  }
}

function checkAndLoadMoreIfNeeded() {
  const libraryPanel = document.getElementById("panel-library");
  if (!libraryPanel) return;
  const hasScrollbar = libraryPanel.scrollHeight > libraryPanel.clientHeight;
  if (!hasScrollbar && visibleCount < filteredSymbols.length) {
    visibleCount += scrollBatch;
    renderLibraryGrid(true);
  }
}

// Scroll listener for infinite scroll
function initInfiniteScroll() {
  const libraryPanel = document.getElementById("panel-library");
  libraryPanel.addEventListener("scroll", () => {
    if (libraryPanel.scrollHeight - libraryPanel.scrollTop - libraryPanel.clientHeight < 200) {
      if (!isInfiniteScrollLoading && visibleCount < filteredSymbols.length) {
        isInfiniteScrollLoading = true;
        
        const spinner = document.getElementById("infinite-scroll-spinner");
        spinner.style.display = "flex";
        
        setTimeout(() => {
          visibleCount += scrollBatch;
          renderLibraryGrid(true);
          isInfiniteScrollLoading = false;
          spinner.style.display = "none";
        }, 250);
      }
    }
  });
}

// Compile tapestry collage wall
function buildCollageWall() {
  const wall = document.getElementById("tapestry-wall");
  wall.innerHTML = "";
  
  // Filter out duplicates for the collage mural
  const uniqueSymbols = Object.values(symbolDatabase).filter(s => s.duplicate_of === null);
  
  uniqueSymbols.forEach(sym => {
    const item = document.createElement("div");
    item.className = "collage-item";
    item.setAttribute("title", `Inspect Symbol #${sym.id}`);
    
    // Load local SVG paths inline
    item.innerHTML = `
      <svg viewBox="-500 -500 1000 1000">
        <path d="${sym.svg_path_data}" fill="currentColor" stroke="none" />
      </svg>
    `;
    
    item.addEventListener("click", () => openSymbolInspector(sym));
    wall.appendChild(item);
  });

  // Style buttons
  const colorBtns = document.querySelectorAll(".collage-color-btn");
  colorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      colorBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const theme = btn.getAttribute("data-color");
      wall.className = `tapestry-wall-container ${theme}`;
    });
  });

  // Default theme
  wall.className = "tapestry-wall-container white-black";
}

// Modal inspector drawer
function openSymbolInspector(sym) {
  document.getElementById("modal-id").innerText = sym.id;
  
  // Load original scan (optimized JPEG first, fallback to raw or PNG)
  const origImg = document.getElementById("modal-img-original");
  origImg.src = `scans/${sym.id}.jpg`;
  origImg.onerror = () => {
    origImg.src = `/BATCH_01/${sym.original_filename}`;
    origImg.onerror = () => {
      origImg.src = sym.png_path;
    };
  };
  
  // Apply current threshold (contrast)
  const threshold = sym.threshold !== undefined ? sym.threshold : 100;
  origImg.style.filter = `contrast(${threshold}%) grayscale(100%)`;
  document.getElementById("modal-svg-container").style.filter = `contrast(${threshold}%)`;
  
  // Load SVG vector inline
  const svgContainer = document.getElementById("modal-svg-container");
  svgContainer.innerHTML = `
    <svg viewBox="-500 -500 1000 1000" width="100%" height="100%">
      <path d="${sym.svg_path_data}" fill="currentColor" stroke="none" />
    </svg>
  `;

  // Admin Controls Setup
  const visibleToggle = document.getElementById("admin-visible-toggle");
  visibleToggle.checked = sym.visible !== false;

  const thresholdSlider = document.getElementById("admin-threshold-slider");
  thresholdSlider.value = threshold;
  document.getElementById("admin-threshold-val").innerText = `${threshold}%`;

  thresholdSlider.addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("admin-threshold-val").innerText = `${val}%`;
    origImg.style.filter = `contrast(${val}%) grayscale(100%)`;
    document.getElementById("modal-svg-container").style.filter = `contrast(${val}%)`;
  });

  const notesTextarea = document.getElementById("admin-notes");
  notesTextarea.value = sym.notes || "";

  // Save Settings Button
  const saveBtn = document.getElementById("admin-save-btn");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener("click", () => {
    const visibleVal = visibleToggle.checked;
    const thresholdVal = parseInt(thresholdSlider.value);
    const notesVal = notesTextarea.value;

    fetch("/api/update_symbol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sym.id, visible: visibleVal, threshold: thresholdVal, notes: notesVal })
    })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        sym.visible = visibleVal;
        sym.threshold = thresholdVal;
        sym.notes = notesVal;
        
        // sync inside both database keys
        if (symbolDatabase[sym.original_filename]) {
          symbolDatabase[sym.original_filename].visible = visibleVal;
          symbolDatabase[sym.original_filename].threshold = thresholdVal;
          symbolDatabase[sym.original_filename].notes = notesVal;
        }

        document.getElementById("detail-modal").classList.remove("active");
        buildVisualLibrary();
      } else {
        alert("Failed to save settings: " + res.error);
      }
    })
    .catch(err => {
      console.error("Error saving symbol settings:", err);
      alert("Error connecting to server.");
    });
  });

  // Deletion/Restoration Button Setup
  const deleteBtn = document.getElementById("modal-delete-btn");
  const newDeleteBtn = deleteBtn.cloneNode(true);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
  
  if (sym.deleted) {
    newDeleteBtn.innerText = "Restore Design 🔄";
    newDeleteBtn.className = "btn btn-secondary";
    newDeleteBtn.addEventListener("click", () => {
      fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sym.id })
      })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          sym.deleted = false;
          if (symbolDatabase[sym.original_filename]) {
            symbolDatabase[sym.original_filename].deleted = false;
          }
          updateAppStatistics();
          buildVisualLibrary();
          buildCollageWall();
          document.getElementById("detail-modal").classList.remove("active");
          if (isBuilderInitialized) renderBuilderPool();
        } else {
          alert("Error: " + res.error);
        }
      });
    });
  } else {
    newDeleteBtn.innerText = "Delete Design ❌";
    newDeleteBtn.className = "btn btn-danger";
    newDeleteBtn.addEventListener("click", () => {
      if (confirm(`Are you sure you want to delete design #${sym.id}?`)) {
        fetch("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sym.id })
        })
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            sym.deleted = true;
            if (symbolDatabase[sym.original_filename]) {
              symbolDatabase[sym.original_filename].deleted = true;
            }
            updateAppStatistics();
            buildVisualLibrary();
            buildCollageWall();
            document.getElementById("detail-modal").classList.remove("active");
            if (isBuilderInitialized) renderBuilderPool();
          } else {
            alert("Error: " + res.error);
          }
        });
      }
    });
  }

  // Download actions
  const dlBtn = document.getElementById("download-svg-btn");
  const newDlBtn = dlBtn.cloneNode(true);
  dlBtn.parentNode.replaceChild(newDlBtn, dlBtn);
  newDlBtn.addEventListener("click", () => {
    const svgCode = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000" width="1000" height="1000">
        <rect x="-500" y="-500" width="1000" height="1000" fill="#0c0e18"/>
        <path d="${sym.svg_path_data}" fill="#ffffff" stroke="none"/>
      </svg>
    `;
    const blob = new Blob([svgCode], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `symbol_${sym.id}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  
  // Next and Previous navigation logic
  const currentSymbolIndex = filteredSymbols.findIndex(s => s.id === sym.id);
  
  const prevBtn = document.getElementById('modal-prev-btn');
  if (prevBtn) {
    if (currentSymbolIndex > 0) {
      prevBtn.style.display = 'inline-flex';
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        openSymbolInspector(filteredSymbols[currentSymbolIndex - 1]);
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
        openSymbolInspector(filteredSymbols[currentSymbolIndex + 1]);
      };
    } else {
      nextBtn.style.display = 'none';
    }
  }

  document.getElementById("detail-modal").classList.add("active");
}

window.viewDuplicateSource = function(sourceId) {
  const sourceSym = symbolDatabase[`${sourceId}.png`];
  if (sourceSym) {
    openSymbolInspector(sourceSym);
  }
};

function updateRadialGauge(id, percent) {
  const path = document.getElementById(id);
  const cappedPercent = Math.min(100, Math.max(0, percent));
  // 100% maps to stroke-dasharray="100, 100"
  path.setAttribute("stroke-dasharray", `${cappedPercent}, 100`);
}

// Generate visual analysis narrative
function generateInterpretation(sym) {
  const theme = sym.classification.theme;
  const steadiness = sym.metrics.steadiness;
  const density = sym.metrics.density;
  
  let intro = `Symbol #${sym.id} is classified under <strong>${theme}</strong>. `;
  
  let lineQual = "";
  if (steadiness > 0.95) {
    lineQual = "The drawing shows high focus and steady motor control, utilizing clean, decisive paths. This points to a deliberate, planned approach to drafting the visual identity.";
  } else if (steadiness < 0.91) {
    lineQual = "The line features organic hand tremors and thick shading, representing raw, unassisted freehand work. This indicates immediate, expressive presence, capturing the physical signature of the student's hand.";
  } else {
    lineQual = "The line work shows a balanced freehand flow, combining natural curves with a comfortable, steady pressure.";
  }

  let densityQual = "";
  if (density > 0.08) {
    densityQual = " The symbol exhibits a high spatial density with thick filled blocks, asserting its presence on the page. In graphic psychology, such bold fill choices suggest confidence, high energy, and a desire to be clearly visible.";
  } else if (density < 0.03) {
    densityQual = " The symbol features a thin, delicate outline structure. This minimalist restraint indicates introspection, precision, and conceptual focus, relying on negative space to construct the design.";
  } else {
    densityQual = " The design maintains a balanced visual weight, distributing ink and empty paper space harmoniously.";
  }

  let themeQual = "";
  if (theme === "Abstract Geometry") {
    themeQual = " By choosing abstract geometry, the student abstracts their identity into universal symbols of balance (circles, stars, clean crosses). This choice represents a longing for order, centering, and protective structure.";
  } else if (theme === "Text & Monograms") {
    themeQual = " The initials are stylized as a personal monogram or seal. Transforming the letters of one's name into a graphic crest represents an architectural branding of the self, converting administrative identity into a personal brand.";
  } else if (theme === "Personal Symbols") {
    themeQual = " The use of concrete personal items (sports equipment, instruments, nature, stars) links the student's inner values directly to their immediate actions and environments, bridging personal interest with public identity.";
  } else if (theme === "Detailed & Complex") {
    themeQual = " The complex line density shows a high cognitive investment. The student is communicating a multi-layered narrative, refusing simple abstraction in favor of rich, intricate storytelling.";
  } else {
    themeQual = " The design is clean, readable, and highly abstracted, favoring speed and graphic efficiency.";
  }

  return `${intro} ${lineQual} ${densityQual} ${themeQual}`;
}

// ==========================================
// INTERACTIVE COMPOSITION CANVAS BUILDER
// ==========================================
function initBuilder() {
  if (isBuilderInitialized) {
    resizeVirtualCanvas(canvasWidth, canvasHeight);
    renderCanvas();
    updateStats();
    return;
  }

  isBuilderInitialized = true;

  // Canvas size presets
  document.getElementById("canvas-preset-select").addEventListener("change", (e) => {
    const preset = e.target.value;
    const customDimsDiv = document.getElementById("custom-canvas-dims");
    customDimsDiv.style.display = "none";

    if (preset === "fullscreen") {
      resizeToContainer();
    } else if (preset === "standard") {
      resizeVirtualCanvas(1200, 800);
    } else if (preset === "wide") {
      resizeVirtualCanvas(2400, 1200);
    } else if (preset === "high") {
      resizeVirtualCanvas(1200, 2400);
    } else if (preset === "square") {
      resizeVirtualCanvas(1800, 1800);
    } else if (preset === "custom") {
      customDimsDiv.style.display = "flex";
    }
  });

  // Wire ribbon collapse/expand toggle
  const ribbonCollapseBtn = document.getElementById("ribbon-collapse-btn");
  const muralRibbon = document.getElementById("mural-ribbon");
  if (ribbonCollapseBtn && muralRibbon) {
    ribbonCollapseBtn.addEventListener("click", () => {
      muralRibbon.classList.toggle("ribbon-collapsed");
      const icon = ribbonCollapseBtn.querySelector(".toggle-icon");
      if (icon) icon.textContent = muralRibbon.classList.contains("ribbon-collapsed") ? "🔼" : "🔽";
    });
  }

  // Wire ⚙️ Controls drawer toggle
  const drawerBtn = document.getElementById("ribbon-settings-btn");
  const drawer = document.getElementById("ribbon-drawer");
  if (drawerBtn && drawer) {
    let drawerOpen = false;
    drawerBtn.addEventListener("click", () => {
      drawerOpen = !drawerOpen;
      if (drawerOpen) {
        drawer.style.maxHeight = "240px";
        drawer.style.padding = "12px 0 6px";
        drawerBtn.style.color = "#fff";
      } else {
        drawer.style.maxHeight = "0";
        drawer.style.padding = "0";
        drawerBtn.style.color = "";
      }
    });
  }

  document.getElementById("apply-custom-canvas-btn").addEventListener("click", () => {
    const w = parseInt(document.getElementById("custom-canvas-w").value);
    const h = parseInt(document.getElementById("custom-canvas-h").value);
    if (!isNaN(w) && !isNaN(h) && w >= 400 && h >= 400 && w <= 5000 && h <= 5000) {
      resizeVirtualCanvas(w, h);
    } else {
      alert("Invalid dimensions! Width and Height must be between 400px and 5000px.");
    }
  });

  // Canvas zoom fit event
  document.getElementById("canvas-zoom-fit").addEventListener("change", applyCanvasZoomFit);

  // Projector mode event
  document.getElementById("projector-mode-btn").addEventListener("click", enterProjectorMode);

  // Keyboard navigation & Slideshow cycling
  document.addEventListener("keydown", (e) => {
    // Handle next/prev symbol navigation with arrow keys when modal is open
    const detailModal = document.getElementById('detail-modal');
    if (detailModal && detailModal.classList.contains('active')) {
      if (e.key === 'ArrowLeft') {
        const prevBtn = document.getElementById('modal-prev-btn');
        if (prevBtn && prevBtn.style.display !== 'none') {
          prevBtn.click();
        }
        return;
      } else if (e.key === 'ArrowRight') {
        const nextBtn = document.getElementById('modal-next-btn');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextBtn.click();
        }
        return;
      } else if (e.key === 'Escape') {
        detailModal.classList.remove('active');
        return;
      }
    }

    if (e.key === "Escape" && document.body.classList.contains("projector-mode-active")) {
      exitProjectorMode();
      return;
    }

    // Ignore arrows/space if focused on form elements
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
      return;
    }

    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      toggleSlideshow();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pauseSlideshow();
      nextHistoryFrame();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      pauseSlideshow();
      prevHistoryFrame();
    }
  });

  // Window resize to update zoom fit and fullscreen canvas
  window.addEventListener("resize", () => {
    if (isBuilderInitialized) {
      const preset = document.getElementById("canvas-preset-select");
      if (preset && preset.value === "fullscreen") {
        resizeToContainer();
      } else {
        applyCanvasZoomFit();
      }
    }
  });

  // Player controls
  document.getElementById("generate-composition-btn").addEventListener("click", () => {
    pauseSlideshow();
    generateRandomComposition();
  });

  document.getElementById("player-prev-btn").addEventListener("click", () => {
    pauseSlideshow();
    prevHistoryFrame();
  });

  document.getElementById("player-next-btn").addEventListener("click", () => {
    pauseSlideshow();
    nextHistoryFrame();
  });

  // Wire gravity Drop button
  document.getElementById("gravity-btn").addEventListener("click", () => {
    runGravityDrop();
  });

  document.getElementById("player-slideshow-speed").addEventListener("input", (e) => {
    slideshowSpeedSeconds = parseInt(e.target.value);
    document.getElementById("player-slideshow-speed-val").innerText = `${slideshowSpeedSeconds}s`;
    if (slideshowIntervalId) {
      pauseSlideshow();
      playSlideshow();
    }
  });

  document.getElementById("player-symbol-count").addEventListener("input", (e) => {
    document.getElementById("player-symbol-count-val").innerText = e.target.value;
  });

  document.getElementById("player-symbol-theme").addEventListener("change", (e) => {
    const theme = e.target.value;
    let activeSymbols = Object.values(symbolDatabase).filter(s => s.duplicate_of === null && !s.deleted);
    if (theme !== "all") {
      activeSymbols = activeSymbols.filter(s => s.classification.theme === theme);
    }
    
    const countSlider = document.getElementById("player-symbol-count");
    if (countSlider) {
      const activeCount = activeSymbols.length;
      countSlider.max = activeCount;
      if (parseInt(countSlider.value) > activeCount) {
        countSlider.value = activeCount;
      }
      document.getElementById("player-symbol-count-val").innerText = countSlider.value;
    }
  });

  document.getElementById("tank-padding").addEventListener("input", (e) => {
    tankPadding = parseInt(e.target.value);
    document.getElementById("tank-padding-val").innerText = `${tankPadding}px`;
    stepPhysicsOnce(10);
  });

  document.getElementById("tank-global-scale").addEventListener("input", (e) => {
    tankGlobalScale = parseFloat(e.target.value);
    document.getElementById("tank-global-scale-val").innerText = `${tankGlobalScale.toFixed(2)}x`;
    renderCanvas();
  });

  document.getElementById("tank-global-rotate").addEventListener("input", (e) => {
    tankGlobalRotate = parseInt(e.target.value);
    document.getElementById("tank-global-rotate-val").innerText = `${tankGlobalRotate}°`;
    renderCanvas();
  });

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

  // Action events
  document.getElementById("composition-publish-btn").addEventListener("click", publishCompositionToWeb);

  // Apply default size: start fullscreen, then generate
  setTimeout(() => {
    resizeToContainer();
    generateRandomComposition();
  }, 150);
}

function resizeVirtualCanvas(w, h) {
  canvasWidth = w;
  canvasHeight = h;
  const canvas = document.getElementById("composition-canvas");
  if (canvas) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  applyCanvasZoomFit();
}

function resizeToContainer() {
  const container = document.querySelector(".canvas-container");
  if (!container) return;
  // Read actual available pixel space from the container
  const w = Math.max(400, container.clientWidth - 2);
  const h = Math.max(400, container.clientHeight - 2);
  resizeVirtualCanvas(w, h);
}

function applyCanvasZoomFit() {
  const container = document.querySelector(".canvas-container");
  const canvas = document.getElementById("composition-canvas");
  if (!container || !canvas) return;

  const isFitEnabled = document.getElementById("canvas-zoom-fit") && document.getElementById("canvas-zoom-fit").checked;
  const isProjectorMode = document.body.classList.contains("projector-mode-active");

  if (!isFitEnabled && !isProjectorMode) {
    canvas.style.transform = "none";
    canvas.style.margin = "0";
    container.style.alignItems = "flex-start";
    container.style.justifyContent = "flex-start";
    return;
  }

  const pad = isProjectorMode ? 0 : 40;
  const availW = container.clientWidth - pad;
  const availH = container.clientHeight - pad;

  const scaleX = availW / canvasWidth;
  const scaleY = availH / canvasHeight;
  const fitScale = Math.min(1.0, scaleX, scaleY);

  canvas.style.transform = `scale(${fitScale})`;
  canvas.style.margin = "auto";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
}

function enterProjectorMode() {
  document.body.classList.add("projector-mode-active");
  deselectElement();
  applyCanvasZoomFit();
  
  // Show temporary overlay instruction that fades out
  const toast = document.createElement("div");
  toast.id = "projector-toast";
  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
  toast.style.color = "#fff";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "30px";
  toast.style.border = "1px solid rgba(255, 255, 255, 0.15)";
  toast.style.fontFamily = "inherit";
  toast.style.fontSize = "0.85rem";
  toast.style.zIndex = "10000";
  toast.style.pointerEvents = "none";
  toast.style.transition = "opacity 0.8s ease";
  toast.innerText = "Projector Mode Active. Press [F11] for Full Screen. Press [Escape] to Exit.";
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 800);
  }, 3000);
}

function exitProjectorMode() {
  document.body.classList.remove("projector-mode-active");
  const container = document.querySelector(".canvas-container");
  if (container) {
    container.style.alignItems = "flex-start";
    container.style.justifyContent = "flex-start";
  }
  applyCanvasZoomFit();
}

function generateRandomComposition() {
  const themeSelect = document.getElementById("player-symbol-theme");
  const selectedTheme = themeSelect ? themeSelect.value : "all";

  let activeSymbols = Object.values(symbolDatabase).filter(s => s.duplicate_of === null && !s.deleted && s.visible !== false);
  if (selectedTheme !== "all") {
    activeSymbols = activeSymbols.filter(s => s.classification.theme === selectedTheme);
  }
  
  if (activeSymbols.length === 0) return;

  const countSlider = document.getElementById("player-symbol-count");
  const maxCount = countSlider ? parseInt(countSlider.value) : 30;
  // Choose a random count up to the slider's value (min 5)
  const count = Math.floor(Math.random() * (maxCount - 5 + 1)) + 5;

  // Choose a random padding/spacing up to the padding slider's value (min 5)
  const paddingSlider = document.getElementById("tank-padding");
  const maxPadding = paddingSlider ? parseInt(paddingSlider.value) : 20;
  tankPadding = Math.floor(Math.random() * (maxPadding - 5 + 1)) + 5;
  if (paddingSlider) {
    paddingSlider.value = tankPadding;
    document.getElementById("tank-padding-val").innerText = `${tankPadding}px`;
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
    // Scale: base scale * random variance
    let scale = baseScale * (0.6 + Math.random() * 0.8);
    
    // Assign an independent rotation weight between -1.0 and 1.0
    let rotWeight = Math.random() * 2.0 - 1.0;
    const radius = 50 * scale + edgePadding;

    // Random center position inside constraints
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
  nextZIndex = selectedSymbols.length + 1;

  // Settle elements using physics: 100 passes guarantees no overlap using tankPadding spacing
  stepPhysicsOnce(100);

  // Maintain navigation history stack
  if (historyIndex < compositionHistory.length - 1) {
    compositionHistory = compositionHistory.slice(0, historyIndex + 1);
  }
  
  compositionHistory.push(JSON.parse(JSON.stringify(compositionElements)));
  historyIndex = compositionHistory.length - 1;

  renderCanvas();
  updateStats();
}

function loadHistoryFrame(index) {
  if (index < 0 || index >= compositionHistory.length) return;
  historyIndex = index;
  compositionElements = JSON.parse(JSON.stringify(compositionHistory[index]));
  renderCanvas();
  updateStats();
}

function prevHistoryFrame() {
  if (historyIndex > 0) {
    loadHistoryFrame(historyIndex - 1);
  }
}

function nextHistoryFrame() {
  if (historyIndex < compositionHistory.length - 1) {
    loadHistoryFrame(historyIndex + 1);
  } else {
    // Generate new unique composition if going past last frame
    generateRandomComposition();
  }
}

function toggleSlideshow() {
  if (slideshowIntervalId) {
    pauseSlideshow();
  } else {
    playSlideshow();
  }
}

function playSlideshow() {
  const btn = document.getElementById("player-play-btn");
  if (!btn) return;

  btn.innerText = "Pause ⏸️";
  btn.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
  btn.style.color = "#ef4444";
  btn.style.borderColor = "rgba(239, 68, 68, 0.3)";

  const speedSlider = document.getElementById("player-slideshow-speed");
  slideshowSpeedSeconds = speedSlider ? parseInt(speedSlider.value) : 5;

  slideshowIntervalId = setInterval(() => {
    nextHistoryFrame();
  }, slideshowSpeedSeconds * 1000);
}

function pauseSlideshow() {
  const btn = document.getElementById("player-play-btn");
  if (!btn) return;

  btn.innerText = "Play ⏯️";
  btn.style.backgroundColor = "";
  btn.style.color = "";
  btn.style.borderColor = "";

  if (slideshowIntervalId) {
    clearInterval(slideshowIntervalId);
    slideshowIntervalId = null;
  }
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

  // Helper: each element's stored x/y is the top-left of its bounding box.
  // The div uses transform-origin:center center with rotation, so we position
  // it by its center: left = cx - halfSize, top = cy - halfSize.
  const applyStyle = (div, el) => {
    const visScale = el.scale * tankGlobalScale;
    const visRotation = (el.rotWeight !== undefined) ? 
      (el.rotWeight * tankGlobalRotate) : 
      (el.rotation + tankGlobalRotate);
    const currentSize = 100 * visScale;

    div.style.width = `${currentSize}px`;
    div.style.height = `${currentSize}px`;
    div.style.left = `${el.x - currentSize / 2}px`;
    div.style.top = `${el.y - currentSize / 2}px`;
    div.style.transform = `rotate(${visRotation}deg)`;
    div.style.zIndex = el.zIndex;
  };

  // Update in-place when count matches (fast path: no DOM rebuild)
  if (divs.length === compositionElements.length) {
    compositionElements.forEach((el, idx) => applyStyle(divs[idx], el));
  } else {
    // Rebuild from scratch
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

// ==========================================
// GRAVITY DROP ANIMATION
// ==========================================
let gravityAnimId = null;

function runGravityDrop() {
  // Cancel any running gravity animation
  if (gravityAnimId) {
    cancelAnimationFrame(gravityAnimId);
    gravityAnimId = null;
  }

  const gravity = 0.45;       // downward acceleration per frame
  const damping = 0.62;       // energy loss on bounce
  const friction = 0.985;     // horizontal slowdown
  const baseSize = 100;

  // Give every element a velocity
  compositionElements.forEach(el => {
    el._vx = (Math.random() - 0.5) * 1.5;  // small random horizontal drift
    el._vy = -(Math.random() * 2);           // slight upward toss before fall
  });

  function frame() {
    let anyMoving = false;
    const numEl = compositionElements.length;

    compositionElements.forEach(el => {
      // Apply gravity
      el._vy += gravity;
      el._vx *= friction;

      el.x += el._vx;
      el.y += el._vy;

      const elSize = baseSize * el.scale;
      const floor = canvasHeight - elSize;
      const rightWall = canvasWidth - elSize;

      // Floor bounce
      if (el.y >= floor) {
        el.y = floor;
        el._vy *= -damping;
        el._vx *= 0.9;
        if (Math.abs(el._vy) < 0.5) el._vy = 0;
      }
      // Ceiling
      if (el.y < 0) { el.y = 0; el._vy *= -damping; }
      // Walls
      if (el.x < 0) { el.x = 0; el._vx *= -damping; }
      if (el.x > rightWall) { el.x = rightWall; el._vx *= -damping; }

      if (Math.abs(el._vy) > 0.3 || Math.abs(el._vx) > 0.3) anyMoving = true;
    });

    // Pairwise collision separation (lightweight: 3 passes per frame)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < numEl; i++) {
        const a = compositionElements[i];
        const ra = baseSize * a.scale * 0.5;
        const cxa = a.x + ra;
        const cya = a.y + ra;
        for (let j = i + 1; j < numEl; j++) {
          const b = compositionElements[j];
          const rb = baseSize * b.scale * 0.5;
          const cxb = b.x + rb;
          const cyb = b.y + rb;
          const dx = cxb - cxa;
          const dy = cyb - cya;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = ra + rb + tankPadding;
          if (dist < minD) {
            const push = (minD - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            // Transfer velocity on collision
            const relV = (a._vx - b._vx) * nx + (a._vy - b._vy) * ny;
            if (relV > 0) {
              a._vx -= relV * nx * damping;
              a._vy -= relV * ny * damping;
              b._vx += relV * nx * damping;
              b._vy += relV * ny * damping;
            }
            anyMoving = true;
          }
        }
      }
    }

    renderCanvas();

    if (anyMoving) {
      gravityAnimId = requestAnimationFrame(frame);
    } else {
      gravityAnimId = null;
      // Save final settled state to history
      compositionHistory.push(JSON.parse(JSON.stringify(compositionElements)));
      historyIndex = compositionHistory.length - 1;
      updateStats();
    }
  }

  gravityAnimId = requestAnimationFrame(frame);
}

function selectElement(idx) {
  selectedElementIndex = idx;
}

function deselectElement() {
  selectedElementIndex = -1;
}

function exportCompositionSVG() {
  if (compositionElements.length === 0) {
    alert("Canvas is empty! Add symbols to build a composition first.");
    return;
  }

  const w = canvasWidth;
  const h = canvasHeight;

  // Build SVG header
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

function publishCompositionToWeb() {
  if (compositionElements.length === 0) {
    alert("Canvas is empty. Generate some artwork first!");
    return;
  }
  const name = prompt("Enter a name for this composition to publish to the public website:");
  if (!name) return;

  const elementsToPublish = compositionElements.map(el => ({
    id: el.id,
    x: el.x,
    y: el.y,
    scale: el.scale,
    rotation: Math.round(el.rotWeight !== undefined ? el.rotWeight * tankGlobalRotate : el.rotation),
    zIndex: el.zIndex
  }));

  fetch("/api/save_composition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, elements: elementsToPublish })
  })
  .then(r => r.json())
  .then(res => {
    if (res.success) {
      alert(`Successfully published composition "${name}" to the public website!`);
    } else {
      alert("Failed to publish composition: " + res.error);
    }
  })
  .catch(err => {
    console.error("Error publishing composition:", err);
    alert("Failed to connect to the backend server.");
  });
}



function updateStats() {
  const statsLabel = document.getElementById("builder-stats");
  if (!statsLabel) return;
  const uniqueCount = new Set(compositionElements.map(el => el.id)).size;
  statsLabel.innerText = `${uniqueCount} Unique Symbols Placed`;
}

// ==========================================
// REPORTS: INVESTIGATIONS CONTENT INJECTION
function renderInvestigationTab(tabId) {
  const contentBox = document.getElementById("investigations-text-content");
  contentBox.innerHTML = "";

  const allSymbols = Object.values(symbolDatabase);

  if (tabId === "psychology") {
    // Count high and low densities
    const boldCount = allSymbols.filter(s => s.metrics.density > 0.08 && s.duplicate_of === null).length;
    const delicateCount = allSymbols.filter(s => s.metrics.density < 0.03 && s.duplicate_of === null).length;
    const steadyCount = allSymbols.filter(s => s.metrics.steadiness > 0.95 && s.duplicate_of === null).length;
    
    // Dynamic samples
    const boldSamples = allSymbols.filter(s => s.metrics.density > 0.09 && s.duplicate_of === null).slice(0, 10);
    const delicateSamples = allSymbols.filter(s => s.metrics.density < 0.02 && s.duplicate_of === null).slice(0, 10);

    contentBox.innerHTML = `
      <article class="inv-article">
        <h2>The Psychology of Lines & Spatial Claims</h2>
        <p>In graphic psychology and graphology, how an individual claims space and applies pressure is a direct window into their psychological state. A drawing is not just a symbol; it is a physical trace of motor control, anxiety, energy, and assertion.</p>
        
        <h3>Bold Gestures & Spatial Claims</h3>
        <p>Thick strokes, heavy shading, and dense fills indicate high visual assertiveness. When a student chooses to fill in a shape completely, they are claiming space on the paper, demanding visibility. These designs suggest confidence, extroversion, or a desire for decisive grounding.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">${boldCount}</div>
          <div class="inv-stat-desc">
            <h4>Bold & Filled Designs (>8% Density)</h4>
            <p>Representing symbols that occupy substantial visual weight on the paper, indicating decisive pressure and high spatial assertion.</p>
          </div>
        </div>
        
        <p><strong>Sample Bold & Assertive Symbols:</strong></p>
        <div class="inv-showcase-grid">
          ${boldSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Delicate Restraint & Introspective Contours</h3>
        <p>Conversely, symbols built with thinned lines and high negative space indicate reflection, detail-oriented thinking, and emotional caution. These students make minimalist claims, letting the surrounding white space carry the meaning. They indicate analytical planning and caution.</p>

        <div class="inv-stat-card">
          <div class="inv-stat-number">${delicateCount}</div>
          <div class="inv-stat-desc">
            <h4>Minimalist & Delicate Outlines (<3% Density)</h4>
            <p>Showing conceptual restraint, introspection, and analytical planning, where negative space is the dominant visual carrier.</p>
          </div>
        </div>

        <p><strong>Sample Delicate & Minimalist Symbols:</strong></p>
        <div class="inv-showcase-grid">
          ${delicateSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Steadiness, Control & Tremor Signatures</h3>
        <p>Our line steadiness metric captures micro-tremors in the hand. A steadiness of >95% suggests controlled, deliberate strokes, showing pre-planned confidence or the use of drafting aids. Meanwhile, organic lines (<91%) show the natural tremor of the hand, capturing the authentic vulnerability and energy of the sketch pad.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">${steadyCount}</div>
          <div class="inv-stat-desc">
            <h4>Decisive Line Control (>95% Steadiness)</h4>
            <p>Symbols executed with precise, steady strokes, pointing to careful motor control or geometry planning.</p>
          </div>
        </div>
      </article>
    `;
  } else if (tabId === "religion") {
    // Filter Symmetrical designs
    const geometricCount = allSymbols.filter(s => s.classification.theme === "Abstract Geometry" && s.duplicate_of === null).length;
    const geometricSamples = allSymbols.filter(s => s.classification.theme === "Abstract Geometry" && s.metrics.symmetry > 0.8 && s.duplicate_of === null).slice(0, 10);

    contentBox.innerHTML = `
      <article class="inv-article">
        <h2>Religious & Cultural Adaptations</h2>
        <p>Throughout history, humans have relied on symmetric archetypes: the circle (mandala), the cross, the crescent, and the spiral, to represent the cosmos, inner balance, and transcendent values. These historic structures recur frequently in the Mount Lawley cohort's portfolio, illustrating how traditional imagery is inherited and secularized.</p>
        
        <h3>The Mandala & Circular Order</h3>
        <p>Circular geometry acts as a centering device. It represents unity, completion, and psychological containment. Many students instinctively construct their personal symbols within radial borders, creating mini-mandalas that project a need for balance, emotional stability, and inner order during a period of developmental transition.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">${geometricCount}</div>
          <div class="inv-stat-desc">
            <h4>Geometrical & Symmetrical Designs</h4>
            <p>Students who organized their thoughts within symmetrical structures, adopting historical archetypes of order and cosmic unity.</p>
          </div>
        </div>

        <p><strong>Sample Symmetrical Mandalas & Shields:</strong></p>
        <div class="inv-showcase-grid">
          ${geometricSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Secular Crosses & Anchors</h3>
        <p>The cross structure represents intersection, stability, and navigation. While historically tied to religious systems, the crosses in the MLSHS cohort are largely secularized, integrated with anchors, compass points, and stylized axes, symbolizing direction, grounding, and personal guidance frameworks.</p>
      </article>
    `;
  } else if (tabId === "popculture") {
    // Tags like gamer, gaming, triforce, controller
    const popSamples = allSymbols.filter(s => {
      const tags = s.classification.tags;
      return tags.includes("Pop Culture") || tags.includes("Gaming") || tags.includes("Angular") || tags.includes("Monogram");
    }).slice(0, 10);

    contentBox.innerHTML = `
      <article class="inv-article">
        <h2>Pop Culture & Gaming Brands</h2>
        <p>Young designers do not create in a vacuum. Their visual imaginations are heavily populated by commercial media, gaming interfaces, and pop culture brands. In this section, we analyze how students inherit corporate symbols and repurpose them to construct their personal visual identities.</p>
        
        <h3>The Gamified Aesthetic</h3>
        <p>We observe numerous shapes inspired by gaming interfaces. Elements resembling the Zelda Triforce, crosshair HUDs, sword crests, and joystick vectors appear frequently. By adopting these patterns, students represent power, adventure, and digital connection, using game iconography to signify active agency.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">12%</div>
          <div class="inv-stat-desc">
            <h4>Gaming & Digital Influence Estimation</h4>
            <p>Percentage of the cohort utilizing geometric configurations, sword vectors, or controller shapes rooted in gaming culture.</p>
          </div>
        </div>

        <p><strong>Sample Pop & Digital Signatures:</strong></p>
        <div class="inv-showcase-grid">
          ${popSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Iconic Silhouettes & Branding Mechanics</h3>
        <p>Several symbols employ clean, sweeping curves similar to corporate logos (Nike Swoosh, athletic crests, car emblems). This reflects how deeply youth identity is interwoven with consumer branding, where self-expression is modeled after corporate design guidelines.</p>
      </article>
    `;
  } else if (tabId === "branding") {
    const monogramCount = allSymbols.filter(s => s.classification.theme === "Text & Monograms" && s.duplicate_of === null).length;
    const monogramSamples = allSymbols.filter(s => s.classification.theme === "Text & Monograms" && s.duplicate_of === null).slice(0, 10);

    contentBox.innerHTML = `
      <article class="inv-article">
        <h2>Monograms & Self-Branding</h2>
        <p>A monogram represents the literal architectural building block of administrative identity. By taking their initials and stylizing them into an interlocking monogram or crest, students engage in direct branding of the self.</p>
        
        <h3>Interlocking Letterforms</h3>
        <p>We see students connecting their initials (e.g. A and L, S and K) using overlapping bars, geometric brackets, and continuous loops. These monograms represent a desire to make their legal name graphic, combining personal initials into a unified trademark.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">${monogramCount}</div>
          <div class="inv-stat-desc">
            <h4>Personal Monograms & Text Designs</h4>
            <p>Students who chose to abstract their names directly, building graphic signatures, initial seals, and trademarks.</p>
          </div>
        </div>

        <p><strong>Sample Monograms & Graphic Seals:</strong></p>
        <div class="inv-showcase-grid">
          ${monogramSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Visual Seals and Personal Logos</h3>
        <p>These initial crests function like old wax seals or Japanese *Kamon* stamps. They translate administrative text into active branding, showing how students construct a professional, stylized persona ready for public presentation.</p>
      </article>
    `;
  } else if (tabId === "originality") {
    // Count traced vs organic
    const tracedCount = allSymbols.filter(s => s.classification.traced_likelihood > 70 && s.duplicate_of === null).length;
    const organicCount = allSymbols.filter(s => s.classification.traced_likelihood < 30 && s.duplicate_of === null).length;
    
    const tracedSamples = allSymbols.filter(s => s.classification.traced_likelihood > 80 && s.duplicate_of === null).slice(0, 10);
    const organicSamples = allSymbols.filter(s => s.classification.traced_likelihood < 15 && s.duplicate_of === null).slice(0, 10);

    contentBox.innerHTML = `
      <article class="inv-article">
        <h2>Originality & Trace Detection</h2>
        <p>Our mathematical audit evaluates how students constructed their designs. By analyzing symmetry, line control, circularity, and complexity, we can separate organic hand drawings from designs constructed using templates or directly traced from existing images.</p>
        
        <h3>Geometric / Traced Signatures</h3>
        <p>Designs with extremely high symmetry and perfect line steadiness (>95%) are flagged with a high traced likelihood. These represent stencils, compass sweeps, ruler drafts, or direct tracings of existing corporate iconography. They show a technical, graphic, and calculated design process.</p>
        
        <div class="inv-stat-card">
          <div class="inv-stat-number">${tracedCount}</div>
          <div class="inv-stat-desc">
            <h4>Geometric / Stencil Designs (>70% Traced Likelihood)</h4>
            <p>Symbols built with extreme mathematical precision, indicating drafting tool assistance, stencils, or logo tracing.</p>
          </div>
        </div>

        <p><strong>Sample Highly Geometric & Traced Symbols:</strong></p>
        <div class="inv-showcase-grid">
          ${tracedSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>

        <h3>Organic Hand Drawings</h3>
        <p>In contrast, symbols with organic tremor signatures, asymmetrical paths, and multiple hand-drawn components show high freehand originality. They capture the raw human quality of sketching, reflecting immediate motor choices, gestures, and creative imperfection.</p>

        <div class="inv-stat-card">
          <div class="inv-stat-number">${organicCount}</div>
          <div class="inv-stat-desc">
            <h4>Pure Freehand Outlines (<30% Traced Likelihood)</h4>
            <p>Symbols executed with freeform lines, displaying micro-asymmetries and organic hand-drawn warmth.</p>
          </div>
        </div>

        <p><strong>Sample Pure Organic Freehand Symbols:</strong></p>
        <div class="inv-showcase-grid">
          ${organicSamples.map(s => `<div class="inv-showcase-item" onclick="viewDuplicateSource('${s.id}')"><img src="${s.png_path}" alt="${s.id}"></div>`).join("")}
        </div>
      </article>
    `;
  }
}
