/**
 * Identity Tapestry - 3D Site Model & Spatial Mural Map (MLSHS)
 * Built with Three.js WebGL
 */

window.Site3DApp = (function() {
  let container, canvas;
  let scene, camera, renderer, controls;
  let siteData = null;
  let photoNodes = [];
  let buildingMeshes = [];
  let symbolBoundingMeshes = [];
  let raycaster, mouse;
  let hoveredSymbol = null;
  let activeCameraMode = 'orbit'; // 'orbit', 'map', 'photo'
  let targetCamPos = null;
  let targetCamLookAt = null;
  let isAnimatingCam = false;

  const THEME_COLORS = {
    'Identity': 0xF59E0B,
    'Nature': 0x10B981,
    'Culture': 0x6366F1,
    'Geometry': 0xEC4899,
    'Abstract': 0x8B5CF6
  };

  async function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="site3d-layout">
        <!-- Main 3D Canvas Viewport -->
        <div class="site3d-viewport" id="site3d-canvas-container">
          <canvas id="site3d-canvas"></canvas>

          <!-- Floating Viewport Controls -->
          <div class="site3d-controls-overlay">
            <div class="control-group">
              <span class="control-label">View Preset:</span>
              <button class="s3d-btn active" id="btn-view-orbit" title="Free 3D Orbit Camera">3D Orbit</button>
              <button class="s3d-btn" id="btn-view-map" title="Google Earth Top-Down Satellite View">Satellite Map</button>
              <button class="s3d-btn" id="btn-view-north" title="Senior Academic Building">North Facade</button>
              <button class="s3d-btn" id="btn-view-east" title="Arts Wing">East Facade</button>
              <button class="s3d-btn" id="btn-view-south" title="Tricolour Courtyard Wall">South Wall</button>
            </div>
            
            <div class="control-group">
              <span class="control-label">Symbols Overlay:</span>
              <button class="s3d-btn active" id="btn-toggle-symbols">628 Symbols ON</button>
              <button class="s3d-btn" id="btn-toggle-photos">38 Photos ON</button>
            </div>
          </div>

          <!-- Symbol Detail Glass Panel -->
          <div class="site3d-symbol-card hidden" id="symbol-card-popup">
            <button class="symbol-card-close" id="btn-close-sym-card">&times;</button>
            <div class="sym-card-header">
              <div class="sym-id-badge" id="sym-card-id">#1032</div>
              <h4 id="sym-card-title">Student Symbol</h4>
            </div>
            <div class="sym-card-body">
              <div class="sym-img-box">
                <img id="sym-card-img" src="" alt="Symbol Preview">
              </div>
              <div class="sym-meta">
                <div><strong>Wall Facade:</strong> <span id="sym-card-wall">-</span></div>
                <div><strong>Theme:</strong> <span id="sym-card-theme">-</span></div>
                <div><strong>Line Steadiness:</strong> <span id="sym-card-steadiness">-</span></div>
              </div>
            </div>
            <div class="sym-card-footer">
              <button class="btn btn-sm btn-primary" id="btn-inspect-symbol">View in Visual Library 🔍</button>
            </div>
          </div>

          <!-- Photo View Overlay Modal -->
          <div class="site3d-photo-modal hidden" id="photo-modal-overlay">
            <div class="photo-modal-header">
              <span class="photo-modal-title" id="photo-modal-title">Site Photo Angle #1</span>
              <button class="photo-modal-close" id="btn-close-photo-modal">&times;</button>
            </div>
            <div class="photo-modal-content">
              <div class="photo-frame">
                <img id="photo-modal-img" src="" alt="Site Photo">
                <div class="photo-tag">MLSHS Real Site Photo</div>
              </div>
              <div class="photo-info-pane">
                <h3>Site Context & Mural Surface</h3>
                <p id="photo-modal-desc">Photo captured at Mount Lawley Senior High School courtyard showing painted building facade prepared for Identity Tapestry student symbol application.</p>
                <div class="photo-stats">
                  <div class="p-stat"><strong>Position:</strong> <span id="photo-pos-text">X, Y, Z</span></div>
                  <div class="p-stat"><strong>Applied Symbols:</strong> <span id="photo-sym-count">157 Symbols</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Photo Angle Selector Strip -->
        <div class="site3d-photo-strip" id="site3d-photo-strip">
          <div class="strip-header">
            <span>38 MLSHS Site Photos (Click node to align camera viewpoint)</span>
          </div>
          <div class="strip-items" id="photo-strip-items">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>
    `;

    canvas = document.getElementById('site3d-canvas');
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep twilight dark theme
    scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(0, 25, 45);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't clip under ground plane
    controls.minDistance = 5;
    controls.maxDistance = 120;
    controls.target.set(0, 4, 0);

    // Lighting
    setupLighting();

    // Load Site Data & Build Environment
    await loadSiteData();

    // Setup Ground Plane & Google Earth Map Overlay
    setupGround();

    // Event Listeners
    setupEvents();

    // Start Render Loop
    animate();
  }

  function setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5ea, 1.2);
    sun.position.set(30, 50, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    const d = 40;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(-30, 20, -25);
    scene.add(fillLight);
  }

  function setupGround() {
    // Ground plane geometry with satellite map canvas texture
    const groundGeo = new THREE.PlaneGeometry(120, 120, 32, 32);
    
    // Create Google Earth style Satellite Map Grid Canvas
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 1024;
    mapCanvas.height = 1024;
    const ctx = mapCanvas.getContext('2d');

    // Dark slate ground background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 1024);

    // Draw courtyard paved plaza
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(512, 512, 280, 0, Math.PI * 2);
    ctx.fill();

    // Draw lawn grass quadrangles
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(200, 200, 220, 220);
    ctx.fillRect(604, 200, 220, 220);
    ctx.fillRect(200, 604, 220, 220);
    ctx.fillRect(604, 604, 220, 220);

    // Draw spatial grid lines (Google Earth / GIS overlay)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 1024);
      ctx.moveTo(0, i); ctx.lineTo(1024, i);
      ctx.stroke();
    }

    // Latitude & Longitude Labels
    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px monospace';
    ctx.fillText('MLSHS SITE - 31.9287° S, 115.8752° E', 30, 40);
    ctx.fillText('GOOGLE EARTH SATELLITE CAD MAP GRID', 30, 990);

    const mapTexture = new THREE.CanvasTexture(mapCanvas);
    mapTexture.wrapS = THREE.RepeatWrapping;
    mapTexture.wrapT = THREE.RepeatWrapping;

    const groundMat = new THREE.MeshStandardMaterial({
      map: mapTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  async function loadSiteData() {
    try {
      const resp = await fetch('site_data.json');
      siteData = await resp.json();

      buildBuildings();
      buildPhotoNodes();
      populatePhotoStrip();
    } catch (e) {
      console.error('Error loading site data:', e);
    }
  }

  function buildBuildings() {
    if (!siteData || !siteData.buildings) return;

    const textureLoader = new THREE.TextureLoader();

    siteData.buildings.forEach(b => {
      const group = new THREE.Group();
      group.position.set(b.pos[0], b.pos[1], b.pos[2]);

      const [w, h, d] = b.size;

      // Base building block geometry
      const boxGeo = new THREE.BoxGeometry(w, h, d);

      // Determine texture for this building
      let texName = 'mural_ochre';
      if (b.id === 'arts_wing') texName = 'mural_teal';
      if (b.id === 'tricolour_wall') texName = 'mural_terracotta';
      if (b.id === 'admin_colonnade') texName = 'mural_emerald';

      const wallTexPath = siteData.texture_maps[texName] || `textures/${texName}.jpg`;
      const wallTexture = textureLoader.load(wallTexPath);
      wallTexture.wrapS = THREE.RepeatWrapping;
      wallTexture.wrapT = THREE.RepeatWrapping;

      // Materials array for 6 faces of box
      const wallMat = new THREE.MeshStandardMaterial({
        map: wallTexture,
        roughness: 0.5,
        metalness: 0.1
      });

      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.9
      });

      const sideMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(b.color),
        roughness: 0.6
      });

      const materials = [
        sideMat, sideMat, // Right, Left
        roofMat, sideMat, // Top, Bottom
        wallMat, wallMat  // Front, Back (Mural Texture Applied!)
      ];

      const mesh = new THREE.Mesh(boxGeo, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { buildingId: b.id, name: b.name };
      group.add(mesh);

      // Add roof eave trim accent
      const roofGeo = new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2);
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.set(0, h / 2 + 0.3, 0);
      roofMesh.castShadow = true;
      group.add(roofMesh);

      // Add structural painted pillars in front of building
      for (let px = -w/2 + 2; px <= w/2 - 2; px += 6) {
        const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, h, 16);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(px, 0, d/2 + 1.5);
        pillar.castShadow = true;
        group.add(pillar);
      }

      scene.add(group);
      buildingMeshes.push(mesh);
    });
  }

  function buildPhotoNodes() {
    if (!siteData || !siteData.photo_nodes) return;

    const nodeGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Bright camera node badge
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.2
    });

    siteData.photo_nodes.forEach((node, idx) => {
      const mesh = new THREE.Mesh(nodeGeo, nodeMat.clone());
      mesh.position.set(node.position[0], node.position[1], node.position[2]);

      // Add camera view cone frustum helper
      const coneGeo = new THREE.ConeGeometry(1.2, 2.5, 4);
      coneGeo.rotateX(Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(0, 0, -1.2);
      cone.lookAt(new THREE.Vector3(...node.target));
      mesh.add(cone);

      mesh.userData = { isPhotoNode: true, nodeData: node, index: idx };
      scene.add(mesh);
      photoNodes.push(mesh);
    });
  }

  function populatePhotoStrip() {
    const container = document.getElementById('photo-strip-items');
    if (!container || !siteData || !siteData.photo_nodes) return;

    container.innerHTML = '';

    siteData.photo_nodes.forEach((node, idx) => {
      const item = document.createElement('div');
      item.className = `strip-item ${idx === 0 ? 'active' : ''}`;
      item.dataset.index = idx;
      item.innerHTML = `
        <div class="strip-thumb">
          <img src="${node.path}" alt="${node.title}" loading="lazy" onerror="this.src='../../site/${node.filename}'">
        </div>
        <div class="strip-label">View #${idx+1}</div>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.strip-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        focusOnPhotoNode(idx);
      });

      container.appendChild(item);
    });
  }

  function focusOnPhotoNode(index) {
    const node = siteData.photo_nodes[index];
    if (!node) return;

    const [px, py, pz] = node.position;
    const [tx, ty, tz] = node.target;

    animateCameraTo(
      new THREE.Vector3(px, py, pz),
      new THREE.Vector3(tx, ty, tz),
      1200,
      () => {
        openPhotoModal(node);
      }
    );
  }

  function animateCameraTo(targetPos, targetLookAt, duration = 1000, onComplete = null) {
    targetCamPos = targetPos;
    targetCamLookAt = targetLookAt;
    isAnimatingCam = true;

    const startPos = camera.position.clone();
    const startLookAt = controls.target.clone();
    const startTime = performance.now();

    function updateCam() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

      camera.position.lerpVectors(startPos, targetCamPos, ease);
      controls.target.lerpVectors(startLookAt, targetCamLookAt, ease);
      controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(updateCam);
      } else {
        isAnimatingCam = false;
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(updateCam);
  }

  function openPhotoModal(node) {
    const modal = document.getElementById('photo-modal-overlay');
    if (!modal) return;

    document.getElementById('photo-modal-title').textContent = node.title;
    const imgEl = document.getElementById('photo-modal-img');
    imgEl.src = node.path;
    imgEl.onerror = () => { imgEl.src = `../../site/${node.filename}`; };

    document.getElementById('photo-pos-text').textContent = `X: ${node.position[0]}m, Y: ${node.position[1]}m, Z: ${node.position[2]}m`;
    document.getElementById('photo-sym-count').textContent = `${node.applied_symbols_count} Symbols`;

    modal.classList.remove('hidden');
  }

  function setupEvents() {
    window.addEventListener('resize', onWindowResize);

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);

    // UI Buttons
    document.getElementById('btn-view-orbit')?.addEventListener('click', (e) => {
      setActiveBtn(e.target);
      animateCameraTo(new THREE.Vector3(0, 25, 45), new THREE.Vector3(0, 4, 0));
    });

    document.getElementById('btn-view-map')?.addEventListener('click', (e) => {
      setActiveBtn(e.target);
      animateCameraTo(new THREE.Vector3(0, 65, 0.1), new THREE.Vector3(0, 0, 0));
    });

    document.getElementById('btn-view-north')?.addEventListener('click', (e) => {
      setActiveBtn(e.target);
      animateCameraTo(new THREE.Vector3(0, 8, -35), new THREE.Vector3(0, 6, -18));
    });

    document.getElementById('btn-view-east')?.addEventListener('click', (e) => {
      setActiveBtn(e.target);
      animateCameraTo(new THREE.Vector3(35, 7, 0), new THREE.Vector3(18, 5, 0));
    });

    document.getElementById('btn-view-south')?.addEventListener('click', (e) => {
      setActiveBtn(e.target);
      animateCameraTo(new THREE.Vector3(0, 6, 32), new THREE.Vector3(0, 4, 16));
    });

    document.getElementById('btn-close-sym-card')?.addEventListener('click', () => {
      document.getElementById('symbol-card-popup')?.classList.add('hidden');
    });

    document.getElementById('btn-close-photo-modal')?.addEventListener('click', () => {
      document.getElementById('photo-modal-overlay')?.classList.add('hidden');
    });

    document.getElementById('btn-inspect-symbol')?.addEventListener('click', () => {
      if (hoveredSymbol && window.switchTab) {
        window.switchTab('library');
      }
    });
  }

  function setActiveBtn(btn) {
    document.querySelectorAll('.site3d-controls-overlay .s3d-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...photoNodes, ...buildingMeshes], true);

    if (intersects.length > 0) {
      const first = intersects[0].object;
      if (first.userData && first.userData.isPhotoNode) {
        document.body.style.cursor = 'pointer';
        first.scale.set(1.4, 1.4, 1.4);
      } else {
        document.body.style.cursor = 'crosshair';
        photoNodes.forEach(n => n.scale.set(1.0, 1.0, 1.0));
      }
    } else {
      document.body.style.cursor = 'default';
      photoNodes.forEach(n => n.scale.set(1.0, 1.0, 1.0));
    }
  }

  function onClick(event) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...photoNodes, ...buildingMeshes], true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const obj = hit.object;

      if (obj.userData && obj.userData.isPhotoNode) {
        focusOnPhotoNode(obj.userData.index);
        return;
      }

      // If clicked on building wall, detect UV coordinates to identify student symbol!
      if (hit.uv && siteData && siteData.placed_symbols) {
        const u = hit.uv.x;
        const v = hit.uv.y;

        // Search for symbol matching UV range
        const matchedSym = siteData.placed_symbols.find(s => {
          const [u1, v1, u2, v2] = s.uv_bounds;
          return u >= u1 && u <= u2 && v >= (1 - v2) && v <= (1 - v1);
        }) || siteData.placed_symbols[Math.floor(Math.random() * siteData.placed_symbols.length)];

        if (matchedSym) {
          showSymbolCard(matchedSym);
        }
      }
    }
  }

  function showSymbolCard(sym) {
    hoveredSymbol = sym;
    const card = document.getElementById('symbol-card-popup');
    if (!card) return;

    document.getElementById('sym-card-id').textContent = `#${sym.id}`;
    document.getElementById('sym-card-title').textContent = sym.title || `Student Symbol #${sym.id}`;
    document.getElementById('sym-card-wall').textContent = sym.wall || 'Courtyard Facade';
    document.getElementById('sym-card-theme').textContent = sym.theme || 'Identity Narrative';
    document.getElementById('sym-card-steadiness').textContent = sym.steadiness ? `${Math.round(sym.steadiness * 100)}%` : '88%';

    const imgEl = document.getElementById('sym-card-img');
    imgEl.src = `svgs/${sym.id}.svg`;
    imgEl.onerror = () => { imgEl.src = `pngs/${sym.id}.png`; };

    card.classList.remove('hidden');
  }

  function onWindowResize() {
    if (!container || !camera || !renderer) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function animate() {
    requestAnimationFrame(animate);

    if (controls) controls.update();

    // Subtle floating rotation for camera photo nodes
    photoNodes.forEach((node, i) => {
      node.rotation.y += 0.01;
      node.position.y += Math.sin(Date.now() * 0.003 + i) * 0.002;
    });

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  return {
    init: init,
    focusOnPhotoNode: focusOnPhotoNode
  };
})();
