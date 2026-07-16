// --- INITIAL SYSTEM CAPTURE ---
const container = document.getElementById("earth-container");
const renderWidth = container && container.clientWidth > 0 ? container.clientWidth : window.innerWidth;
const renderHeight = container && container.clientHeight > 0 ? container.clientHeight : window.innerHeight;

let selectedSatelliteIds = []; // Track by Unique ID instead of Name string
let rawTelemetryCache = [];       
let currentFilter = "ALL"; 

// Camera Animation States
let isAnimatingCamera = false;
const targetCameraPos = new THREE.Vector3();
const cameraTransitionSpeed = 0.05; 

// Scene Setup
const scene = new THREE.Scene();
scene.background = null;

// Camera Setup
const camera = new THREE.PerspectiveCamera(45, renderWidth / renderHeight, 0.01, 1000);
camera.position.set(0, 2.8, 3.8); 

// WebGL Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(renderWidth, renderHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 

if (container) {
    container.appendChild(renderer.domElement);
} else {
    document.body.appendChild(renderer.domElement);
}

// Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 10;
controls.minDistance = 0.1; 

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let constellationNetworkMesh = null;
const trackingFootprintsFleet = {};
let radarSweepRing = null;

// Telemetry Canvas HUD Setup
let telemetryCanvas = document.getElementById("telemetry-graph");
let canvasCtx = null;

// 6-Sector Palette Matrix
const SYSTEM_PALETTE = {
    COMMUNICATION: 0xFFB300,  // Retro Amber
    NAVIGATION: 0x00E5FF,     // Ice Cyan
    MILITARY: 0xFF2A2A,       // Warning Red
    SCIENTIFIC: 0x00FF66,     // Terminal Green
    WEATHER: 0x9D00FF,        // Psionic Purple
    DEEP_SPACE: 0xFF00AA,     // Neon Magenta
    DEFAULT: 0x00FF66
};

// ==========================================
// UNIFIED CLASSIFICATION HELPERS
// ==========================================
function isCommunication(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    return typeUpper.includes("COMMUNICATION") || nameUpper.includes("STARLINK") || nameUpper.includes("ONEWEB");
}

function isNavigation(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    return typeUpper.includes("NAVIGATION") || nameUpper.includes("GPS") || nameUpper.includes("GLONASS") || nameUpper.includes("GALILEO") || nameUpper.includes("BEIDOU");
}

function isMilitary(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    if (typeUpper.includes("MILITARY") || typeUpper.includes("RECONNAISSANCE")) return true;
    
    // Comprehensive client-side fallback matching backend military filters
    const milKeywords = [
        "USA", "AEHF", "WGS", "SBIRS", "KH-", "ONYX", 
        "KOSMOS", "BARS-M", "TUNDRA", "YAOGAN", 
        "SYRACUSE", "SKYNET", "SAR-LUPE", "SENTRY", "RECON"
    ];
    return milKeywords.some(k => nameUpper.includes(k));
}

function isScientific(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    return typeUpper.includes("SCIENTIFIC") || typeUpper.includes("SPACE STATION") || 
           nameUpper.includes("ISS") || nameUpper.includes("CSS") || 
           nameUpper.includes("TIANGONG") || nameUpper.includes("RESEARCH") || 
           nameUpper.includes("ZARYA") || nameUpper.includes("NAUKA") || nameUpper.includes("TIANHE");
}

function isWeather(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    return typeUpper.includes("WEATHER") || typeUpper.includes("METEO") || 
           nameUpper.includes("METEO") || nameUpper.includes("WEATHER") || 
           nameUpper.includes("NOAA") || nameUpper.includes("GOES") || nameUpper.includes("LANDSAT") || nameUpper.includes("SENTINEL");
}

function isDeepSpace(satName, satType) {
    const typeUpper = (satType || "").toUpperCase();
    const nameUpper = (satName || "").toUpperCase();
    return typeUpper.includes("DEEP_SPACE") || nameUpper.includes("HUBBLE") || nameUpper.includes("JWST") || nameUpper.includes("TELESCOPE");
}

function getSatelliteColor(satName, satType) {
    if (isCommunication(satName, satType)) return SYSTEM_PALETTE.COMMUNICATION;
    if (isNavigation(satName, satType)) return SYSTEM_PALETTE.NAVIGATION;
    if (isMilitary(satName, satType)) return SYSTEM_PALETTE.MILITARY;
    if (isScientific(satName, satType)) return SYSTEM_PALETTE.SCIENTIFIC;
    if (isWeather(satName, satType)) return SYSTEM_PALETTE.WEATHER;
    if (isDeepSpace(satName, satType)) return SYSTEM_PALETTE.DEEP_SPACE;
    
    const nameUpper = (satName || "").toUpperCase();
    const code = nameUpper.charCodeAt(0) || 0;
    const choices = Object.values(SYSTEM_PALETTE).slice(0, 6);
    return choices[code % choices.length];
}

function setupTelemetryCanvas() {
    telemetryCanvas = document.getElementById("telemetry-graph");
    if (telemetryCanvas) {
        canvasCtx = telemetryCanvas.getContext("2d");
        return;
    }
    
    const targetPanel = document.getElementById("satellite-roster")?.parentElement || document.body;
    
    const filterContainer = document.createElement("div");
    filterContainer.style.display = "grid";
    filterContainer.style.gridTemplateColumns = "1fr 1fr";
    filterContainer.style.gap = "4px";
    filterContainer.style.marginBottom = "10px";

    const filterTypes = ["ALL", "COMMUNICATION", "NAVIGATION", "MILITARY", "SCIENTIFIC", "WEATHER"];
    filterTypes.forEach(type => {
        const btn = document.createElement("button");
        btn.innerText = type;
        btn.style.background = type === "ALL" ? "rgba(0, 229, 255, 0.15)" : "rgba(2, 2, 8, 0.8)";
        btn.style.color = "#00ff66";
        btn.style.border = "1px solid rgba(0, 255, 102, 0.15)";
        btn.style.fontSize = "0.55rem";
        btn.style.fontFamily = "monospace";
        btn.style.padding = "4px";
        btn.style.cursor = "pointer";
        btn.className = "matrix-filter-btn";
        btn.dataset.filter = type;

        btn.onclick = () => {
            currentFilter = type;
            document.querySelectorAll(".matrix-filter-btn").forEach(b => b.style.background = "rgba(2, 2, 8, 0.8)");
            btn.style.background = "rgba(0, 229, 255, 0.15)";
            updateSidebarRoster();
            applyFleetVisibilityFilters();
        };
        filterContainer.appendChild(btn);
    });
    
    const targetReferenceNode = document.getElementById("satellite-roster");
    if (targetReferenceNode) {
        targetPanel.insertBefore(filterContainer, targetReferenceNode);
    }

    const wrapper = document.createElement("div");
    wrapper.style.padding = "10px";
    wrapper.style.background = "rgba(2, 2, 8, 0.8)";
    wrapper.style.borderTop = "1px solid rgba(0, 255, 102, 0.2)";
    wrapper.style.marginTop = "10px";
    
    const title = document.createElement("div");
    title.innerText = "SENTRY COMMAND DATA FEED";
    title.style.fontSize = "0.7rem";
    title.style.color = "#00e5ff";
    title.style.marginBottom = "5px";
    title.style.letterSpacing = "1.5px";
    
    telemetryCanvas = document.createElement("canvas");
    telemetryCanvas.id = "telemetry-graph";
    telemetryCanvas.width = 250;
    telemetryCanvas.height = 60;
    telemetryCanvas.style.display = "block";
    telemetryCanvas.style.width = "100%";
    
    wrapper.appendChild(title);
    wrapper.appendChild(telemetryCanvas);
    targetPanel.appendChild(wrapper);
    
    canvasCtx = telemetryCanvas.getContext("2d");
}

function latLonToVector3(lat, lon, radius) {
    const phi = (lat * Math.PI) / 180;
    const theta = (lon * Math.PI) / 180;
    const x = radius * Math.cos(phi) * Math.sin(theta);
    const y = radius * Math.sin(phi);
    const z = radius * Math.cos(phi) * Math.cos(theta);
    return new THREE.Vector3(x, y, z);
}

// 🌍 PLANETARY ENGINE
const oceanGeo = new THREE.SphereGeometry(1, 64, 64);
const oceanMat = new THREE.MeshBasicMaterial({ color: 0x020208, transparent: true, opacity: 0.95 });
const earthCore = new THREE.Mesh(oceanGeo, oceanMat);
scene.add(earthCore);

const earthContinents = new THREE.Group();
scene.add(earthContinents);

const continentColors = [0x00ff66, 0x00e5ff, 0xffb300, 0xff2a2a];

fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')
    .then(res => res.json())
    .then(geoJson => {
        geoJson.features.forEach((feature, index) => {
            if (!feature.geometry) return;
            const { type, coordinates } = feature.geometry;
            const assignedColor = continentColors[index % continentColors.length];
            const lineMat = new THREE.LineBasicMaterial({ color: assignedColor, linewidth: 1 });
            
            const processPolygon = (polygonCoords) => {
                const points = [];
                polygonCoords.forEach(coord => points.push(latLonToVector3(coord[1], coord[0], 1.005)));
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMat);
                earthContinents.add(line);
            };

            if (type === 'Polygon') processPolygon(coordinates[0]);
            else if (type === 'MultiPolygon') coordinates.forEach(poly => processPolygon(poly[0]));
        });
    })
    .catch(err => console.error(err));

const globalGrid = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 30, 15), 
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.05 })
);
scene.add(globalGrid);

const sweepGeo = new THREE.RingGeometry(1.02, 1.6, 32);
const sweepMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.06, side: THREE.DoubleSide, wireframe: true });
radarSweepRing = new THREE.Mesh(sweepGeo, sweepMat);
radarSweepRing.rotation.x = Math.PI / 2;
scene.add(radarSweepRing);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const satelliteFleet = {};
const orbitLinesFleet = {}; 

function createSatelliteModel(satName, satType) {
    const satGroup = new THREE.Group();
    const spinContainer = new THREE.Group();
    spinContainer.name = "spinContainer"; 
    satGroup.add(spinContainer);

    const themeColor = getSatelliteColor(satName, satType);

    const structuralMat = new THREE.MeshBasicMaterial({ color: 0x111116 }); 
    const matrixPanelMat = new THREE.MeshBasicMaterial({ color: themeColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const goldMirrorMat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const frameLineMat = new THREE.LineBasicMaterial({ color: themeColor });

    function attachWireframe(mesh) {
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const lines = new THREE.LineSegments(edges, frameLineMat);
        mesh.add(lines);
    }

    // Unified helper classification matching
    if (isCommunication(satName, satType)) {
        const bus = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.006), structuralMat);
        attachWireframe(bus);
        spinContainer.add(bus);

        const arrayWing = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.11), matrixPanelMat);
        arrayWing.position.set(0, 0.07, 0);
        attachWireframe(arrayWing);
        spinContainer.add(arrayWing);
    } 
    else if (isNavigation(satName, satType)) {
        const boxBus = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.026), structuralMat);
        attachWireframe(boxBus);
        spinContainer.add(boxBus);

        const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.016), matrixPanelMat);
        leftWing.position.set(-0.055, 0, 0);
        attachWireframe(leftWing);
        
        const rightWing = leftWing.clone();
        rightWing.position.x = 0.055;
        spinContainer.add(leftWing, rightWing);

        const transmissionNadir = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.007, 0.014, 6), structuralMat);
        transmissionNadir.position.set(0, 0, -0.014);
        transmissionNadir.rotation.x = Math.PI / 2;
        attachWireframe(transmissionNadir);
        spinContainer.add(transmissionNadir);
    }
    else if (isMilitary(satName, satType)) { // Now correctly matches Military satellites!
        const telescopeBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.065, 12), structuralMat);
        telescopeBarrel.rotation.x = Math.PI / 2;
        attachWireframe(telescopeBarrel);
        spinContainer.add(telescopeBarrel);

        const openAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 12, 1, true), matrixPanelMat);
        openAperture.position.set(0, 0, 0.035);
        openAperture.rotation.x = Math.PI / 2;
        attachWireframe(openAperture);
        spinContainer.add(openAperture);

        const leftSolar = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.018), matrixPanelMat);
        leftSolar.position.set(-0.038, 0, -0.01);
        attachWireframe(leftSolar);
        const rightSolar = leftSolar.clone();
        rightSolar.position.x = 0.038;
        spinContainer.add(leftSolar, rightSolar);
    }
    else if (isScientific(satName, satType)) {
        const structuralTruss = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 4), structuralMat);
        structuralTruss.rotation.z = Math.PI / 2;
        attachWireframe(structuralTruss);
        spinContainer.add(structuralTruss);

        const habitatCores = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.018), structuralMat);
        attachWireframe(habitatCores);
        spinContainer.add(habitatCores);

        [-0.055, -0.035, 0.035, 0.055].forEach(xOffset => {
            const solarTop = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.06), matrixPanelMat);
            solarTop.position.set(xOffset, 0.035, 0);
            attachWireframe(solarTop);

            const solarBottom = solarTop.clone();
            solarBottom.position.y = -0.035;
            spinContainer.add(solarTop, solarBottom);
        });
    }
    else if (isWeather(satName, satType)) {
        const bodyHex = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.032, 6), structuralMat);
        bodyHex.rotation.x = Math.PI / 2;
        attachWireframe(bodyHex);
        spinContainer.add(bodyHex);

        const asymmetricPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.016), matrixPanelMat);
        asymmetricPanel.position.set(-0.042, 0, 0);
        attachWireframe(asymmetricPanel);
        spinContainer.add(asymmetricPanel);
    }
    else {
        const shieldDeck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.004, 0.065), structuralMat);
        attachWireframe(shieldDeck);
        spinContainer.add(shieldDeck);

        const hexReflector = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 6), goldMirrorMat);
        hexReflector.position.set(0, 0.014, 0);
        hexReflector.rotation.x = Math.PI / 3.5;
        attachWireframe(hexReflector);
        spinContainer.add(hexReflector);
    }

    const hitBox = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 }));
    satGroup.add(hitBox);
    return satGroup;
}

function updateOrbitLinePoints(orbitLine, satData, radius) {
    const points = [];
    if (satData.orbit && Array.isArray(satData.orbit) && satData.orbit.length > 0) {
        satData.orbit.forEach(pt => {
            points.push(latLonToVector3(pt.lat, pt.lon, radius));
        });
        points.push(latLonToVector3(satData.orbit[0].lat, satData.orbit[0].lon, radius));
    } 
    if (points.length > 0) {
        orbitLine.geometry.setFromPoints(points);
    }
}

function updateTrackingFootprintCone(satId, satName, satType, position, radius) {
    let coneMesh = trackingFootprintsFleet[satId];
    const themeColor = getSatelliteColor(satName, satType);
    const coneHeight = radius - 1.0;
    const footprintRadius = Math.sqrt(Math.pow(radius, 2) - 1.0) * 0.22;

    if (!coneMesh) {
        const coneGeo = new THREE.ConeGeometry(footprintRadius, coneHeight, 8, 1, true);
        coneGeo.translate(0, -coneHeight / 2, 0); 
        coneGeo.rotateX(Math.PI / 2);
        coneMesh = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: themeColor, transparent: true, opacity: 0.08, wireframe: true, side: THREE.DoubleSide }));
        scene.add(coneMesh); 
        trackingFootprintsFleet[satId] = coneMesh;
    }
    coneMesh.position.copy(position); 
    coneMesh.lookAt(0, 0, 0);
    coneMesh.visible = selectedSatelliteIds.includes(satId) && matchesFilter({ name: satName, type: satType });
}

function matchesFilter(satData) {
    if (currentFilter === "ALL") return true;
    if (currentFilter === "COMMUNICATION") return isCommunication(satData.name, satData.type);
    if (currentFilter === "NAVIGATION") return isNavigation(satData.name, satData.type);
    if (currentFilter === "MILITARY") return isMilitary(satData.name, satData.type);
    if (currentFilter === "SCIENTIFIC") return isScientific(satData.name, satData.type);
    if (currentFilter === "WEATHER") return isWeather(satData.name, satData.type);
    return true;
}

function applyFleetVisibilityFilters() {
    rawTelemetryCache.forEach((satData) => {
        const visible = matchesFilter(satData);
        if (satelliteFleet[satData.id]) satelliteFleet[satData.id].visible = visible;
        if (orbitLinesFleet[satData.id]) orbitLinesFleet[satData.id].visible = visible;
        if (trackingFootprintsFleet[satData.id]) trackingFootprintsFleet[satData.id].visible = visible && selectedSatelliteIds.includes(satData.id);
    });
    updateConstellationNetworkLines(); 
}

function updateSidebarRoster() {
    const rosterContainer = document.getElementById("satellite-roster");
    if (!rosterContainer) return;
    
    const searchQuery = document.getElementById("matrix-search")?.value.toUpperCase() || "";
    rosterContainer.innerHTML = ""; 

    rawTelemetryCache.forEach((satData) => {
        if (!satData.name.toUpperCase().includes(searchQuery) || !matchesFilter(satData)) return;

        const div = document.createElement("div");
        div.className = "roster-item" + (selectedSatelliteIds.includes(satData.id) ? " active" : "");
        div.innerText = satData.name;
        
        const themeColor = getSatelliteColor(satData.name, satData.type);
        div.style.borderLeft = `3px solid #${themeColor.toString(16).padStart(6, '0')}`;
        div.onclick = (e) => { e.stopPropagation(); selectSatelliteTarget(satData.id, e.shiftKey); };
        rosterContainer.appendChild(div);
    });
}

function updateConstellationNetworkLines() {
    if (constellationNetworkMesh) { 
        scene.remove(constellationNetworkMesh); 
        constellationNetworkMesh.geometry.dispose(); 
        constellationNetworkMesh = null; 
    }
    const validPositions = [];
    selectedSatelliteIds.forEach(id => {
        const satMesh = satelliteFleet[id];
        if (satMesh && satMesh.visible) validPositions.push(satMesh.position.clone());
    });
    if (validPositions.length < 2) return;

    const linePoints = [];
    for (let i = 0; i < validPositions.length; i++) {
        for (let j = i + 1; j < validPositions.length; j++) { 
            linePoints.push(validPositions[i], validPositions[j]); 
        }
    }
    constellationNetworkMesh = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5 }));
    scene.add(constellationNetworkMesh);
}

function selectSatelliteTarget(id, isMultiSelect) {
    if (isMultiSelect) {
        if (selectedSatelliteIds.includes(id)) {
            selectedSatelliteIds = selectedSatelliteIds.filter(n => n !== id);
            if (trackingFootprintsFleet[id]) trackingFootprintsFleet[id].visible = false;
        } else { selectedSatelliteIds.push(id); }
    } else {
        Object.keys(trackingFootprintsFleet).forEach(key => trackingFootprintsFleet[key].visible = false);
        selectedSatelliteIds = [id];
    }
    updateSidebarRoster(); 
    updateHUDTextPanel(); 
    updateConstellationNetworkLines();

    if (!isMultiSelect && selectedSatelliteIds.length > 0) {
        const targetMesh = satelliteFleet[id];
        if (targetMesh) { 
            targetCameraPos.copy(targetMesh.position).add(targetMesh.position.clone().normalize().multiplyScalar(1.4)); 
            isAnimatingCamera = true; 
        }
    }
}

function unselectSatelliteSystem() {
    selectedSatelliteIds = []; 
    targetCameraPos.set(0, 2.8, 3.8); 
    isAnimatingCamera = true;
    Object.keys(trackingFootprintsFleet).forEach(key => trackingFootprintsFleet[key].visible = false);
    updateSidebarRoster(); 
    updateHUDTextPanel(); 
    updateConstellationNetworkLines();
}

// --- UPGRADED TELEMETRY HUD BINDING ENGINE ---
function updateHUDTextPanel() {
    if (!rawTelemetryCache.length) return;
    let targetData = rawTelemetryCache.find(s => s.id === selectedSatelliteIds[selectedSatelliteIds.length - 1]);
    
    if (!targetData) {
        // Clear HUD back to baseline readiness matrices
        ["name", "type", "country", "purpose", "lat", "lon", "alt", "speed", "period", "dimensions", "power"].forEach(domId => {
            const el = document.getElementById(domId);
            if (el) el.innerHTML = domId === "name" ? (selectedSatelliteIds.length > 0 ? "MATRIX CONSTELLATION SYNCED" : "GRID SENTRY READY") : "---";
        });
        const descEl = document.getElementById("desc");
        if (descEl) descEl.innerHTML = "Select an orbital unit to map core sub-systems.";
        return;
    }
    
    // Inject real-world identity metrics and positional telemetry coordinates
    if(document.getElementById("name")) document.getElementById("name").innerHTML = selectedSatelliteIds.length > 1 ? `CONSTELLATION MESH [${selectedSatelliteIds.length} LINKS]` : `TARGET // ${targetData.name}`;
    if(document.getElementById("type")) document.getElementById("type").innerHTML = targetData.type;
    if(document.getElementById("country")) document.getElementById("country").innerHTML = targetData.country;
    if(document.getElementById("purpose")) document.getElementById("purpose").innerHTML = targetData.purpose;
    if(document.getElementById("lat")) document.getElementById("lat").innerHTML = targetData.lat.toFixed(4) + "°";
    if(document.getElementById("lon")) document.getElementById("lon").innerHTML = targetData.lon.toFixed(4) + "°";
    if(document.getElementById("alt")) document.getElementById("alt").innerHTML = targetData.alt.toFixed(1) + " KM";
    
    // Inject advanced physics calculations and mechanical metadata fallback arrays
    if(document.getElementById("speed")) document.getElementById("speed").innerHTML = (targetData.speed ? targetData.speed.toLocaleString() : "---") + " KM/H";
    if(document.getElementById("period")) document.getElementById("period").innerHTML = (targetData.period || "---") + " MINS";
    if(document.getElementById("dimensions")) document.getElementById("dimensions").innerHTML = targetData.dimensions || "---";
    if(document.getElementById("power")) document.getElementById("power").innerHTML = targetData.power || "---";
    if(document.getElementById("desc")) document.getElementById("desc").innerHTML = targetData.desc || "Operational hardware stack passing standard operational status vectors.";
}

async function updateSatelliteFleet() {
    try {
        const response = await fetch("http://127.0.0.1:8000/satellites");
        const data = await response.json();
        
        rawTelemetryCache = data.satellites || [];

        // Dynamic Fleet Sync via unique NORAD tracking IDs
        const activeIds = rawTelemetryCache.map(s => s.id);
        Object.keys(satelliteFleet).forEach(id => {
            if (!activeIds.includes(parseInt(id))) {
                scene.remove(satelliteFleet[id]);
                scene.remove(orbitLinesFleet[id]);
                if (trackingFootprintsFleet[id]) scene.remove(trackingFootprintsFleet[id]);
                delete satelliteFleet[id];
                delete orbitLinesFleet[id];
                delete trackingFootprintsFleet[id];
            }
        });

        rawTelemetryCache.forEach((satData) => {
            let satMesh = satelliteFleet[satData.id];
            let orbitLine = orbitLinesFleet[satData.id];
            const radius = 1.30 + (satData.alt / 6000.0); 
            const position = latLonToVector3(satData.lat, satData.lon, radius);
            const themeColor = getSatelliteColor(satData.name, satData.type);

            if (!satMesh) {
                satMesh = createSatelliteModel(satData.name, satData.type);
                satMesh.userData = { id: satData.id, name: satData.name, type: satData.type }; 
                scene.add(satMesh); 
                satelliteFleet[satData.id] = satMesh;

                orbitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: themeColor, transparent: true, opacity: 0.15 }));
                scene.add(orbitLine); 
                orbitLinesFleet[satData.id] = orbitLine;
            }

            satMesh.position.copy(position); 
            satMesh.lookAt(0, 0, 0); 
            updateOrbitLinePoints(orbitLine, satData, radius);
            updateTrackingFootprintCone(satData.id, satData.name, satData.type, position, radius);

            if (selectedSatelliteIds.includes(satData.id)) {
                orbitLine.material.opacity = 0.85; 
                orbitLine.material.color.setHex(0x00ffcc); 
            } else {
                orbitLine.material.opacity = 0.15; 
                orbitLine.material.color.setHex(themeColor); 
            }
        });

        applyFleetVisibilityFilters(); 
        updateHUDTextPanel(); 
        updateSidebarRoster();
        
        if(document.getElementById("time")) document.getElementById("time").innerHTML = new Date().toISOString().substring(11, 19) + " TACTICAL UTC";
        if(document.getElementById("status")) document.getElementById("status").innerHTML = "● SYSTEM COMMAND INTERCEPTOR ACTIVE // REAL TRACKED CORES: " + rawTelemetryCache.length;

    } catch (error) { 
        console.error("Backend Disconnected:", error); 
        if(document.getElementById("status")) document.getElementById("status").innerHTML = "▲ BACKEND DATA FEED LOSS // RE-ATTEMPTING COMMS...";
    }
}

// Click Trigger Mechanics
let mouseDownPos = { x: 0, y: 0 };
if (container) {
    container.addEventListener("mousedown", (e) => { mouseDownPos.x = e.clientX; mouseDownPos.y = e.clientY; });
    container.addEventListener("mouseup", (e) => {
        // Prevent trigger if the user was dragging the camera around
        if (Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)) > 3) return;
        
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1; 
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(Object.values(satelliteFleet).filter(m => m.visible), true);

        if (intersects.length > 0) {
            let intersectedObject = intersects[0].object;
            let foundSatelliteId = null;

            // Walk up the visual parent hierarchy tree to find the node possessing our target id tracking vectors
            while (intersectedObject) {
                if (intersectedObject.userData && intersectedObject.userData.id) {
                    foundSatelliteId = intersectedObject.userData.id;
                    break;
                }
                intersectedObject = intersectedObject.parent;
            }

            if (foundSatelliteId) {
                selectSatelliteTarget(foundSatelliteId, e.shiftKey);
            } else {
                unselectSatelliteSystem();
            }
        } else { 
            unselectSatelliteSystem(); 
        }
    });
}

let waveOffset = 0;
function drawTelemetryWave() {
    if (!canvasCtx || !telemetryCanvas) return;
    canvasCtx.clearRect(0, 0, telemetryCanvas.width, telemetryCanvas.height);
    for (let i = 0; i < telemetryCanvas.width; i += 20) {
        canvasCtx.strokeStyle = "rgba(0, 229, 255, 0.05)"; 
        canvasCtx.beginPath(); 
        canvasCtx.moveTo(i, 0); 
        canvasCtx.lineTo(i, telemetryCanvas.height); 
        canvasCtx.stroke();
    }
    let amplitude = 12, frequency1 = 0.035, colorLine = "#00ff66";
    if (selectedSatelliteIds.length > 0 && rawTelemetryCache.length) {
        const targetData = rawTelemetryCache.find(s => s.id === selectedSatelliteIds[selectedSatelliteIds.length - 1]);
        if (targetData) {
            amplitude = Math.max(5, 25 - (targetData.alt / 1000)); 
            frequency1 = 0.02 + (Math.abs(targetData.lat) / 3000);
            colorLine = "#" + getSatelliteColor(targetData.name, targetData.type).toString(16).padStart(6, '0');
        }
    }
    canvasCtx.strokeStyle = colorLine; 
    canvasCtx.lineWidth = 1.5; 
    canvasCtx.beginPath();
    for (let x = 0; x < telemetryCanvas.width; x++) {
        const y = telemetryCanvas.height / 2 + Math.sin(x * frequency1 + waveOffset) * amplitude + Math.cos(x * 0.09 - waveOffset) * (amplitude * 0.2);
        if (x === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke(); 
    waveOffset += 0.04; 
}

let radarPulseDir = 1;
function animate() {
    requestAnimationFrame(animate);
    if (earthCore) earthCore.rotation.y += 0.0002;
    if (earthContinents) earthContinents.rotation.y += 0.0002;
    if (globalGrid) globalGrid.rotation.y += 0.0002;

    if (radarSweepRing) {
        radarSweepRing.scale.x += 0.001 * radarPulseDir; 
        radarSweepRing.scale.y += 0.001 * radarPulseDir;
        if (radarSweepRing.scale.x > 1.25) radarPulseDir = -1; 
        if (radarSweepRing.scale.x < 0.95) radarPulseDir = 1;
    }
    for (const id in satelliteFleet) {
        const spin = satelliteFleet[id].getObjectByName("spinContainer");
        if (spin && satelliteFleet[id].visible) spin.rotation.z += 0.012; 
    }
    updateConstellationNetworkLines();

    if (isAnimatingCamera) {
        let last = selectedSatelliteIds[selectedSatelliteIds.length - 1];
        let targetLookAt = new THREE.Vector3(0, 0, 0);

        if (last && satelliteFleet[last]?.visible) {
            targetLookAt.copy(satelliteFleet[last].position);
        }

        // Interpolate target and camera vectors smoothly
        controls.target.lerp(targetLookAt, cameraTransitionSpeed); 
        camera.position.lerp(targetCameraPos, cameraTransitionSpeed);

        // Turn off camera animation flag once camera vector is securely within snapping thresholds
        if (camera.position.distanceTo(targetCameraPos) < 0.01 && 
            controls.target.distanceTo(targetLookAt) < 0.01) {
            isAnimatingCamera = false;
        }
    }
    drawTelemetryWave(); 
    controls.update(); 
    renderer.render(scene, camera);
}

setupTelemetryCanvas(); 
animate();
setInterval(updateSatelliteFleet, 2000); 
updateSatelliteFleet();
document.getElementById("matrix-search")?.addEventListener("input", () => updateSidebarRoster());

window.addEventListener("resize", () => {
    if (!container) return; 
    camera.aspect = container.clientWidth / container.clientHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(container.clientWidth, container.clientHeight);
});