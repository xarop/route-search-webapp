/**
 * OptiRoute / Real Route Finder
 * Multi-platform Vehicle Jockey & Mission Planner (Otoqi, Driiveme, Onlogist)
 * Developed in Barcelona by xarop.com
 */

// API Endpoints
const OSRM_DEFAULT = "https://router.project-osrm.org/route/v1/driving";
const PHOTON_GEOCODE = "https://photon.komoot.io/api/";

// Platform Pricing Profiles for Jockey Relocations
const platformProfiles = {
  otoqui: {
    label: "Otoqi",
    badgeClass: "badge-otoqi",
    baseFee: 24,
    perKm: 0.28,
    appUrl: "https://en.otoqi.com/",
    mobileDeepLink: "otoqi://missions",
    portalName: "Otoqi Driver Portal",
    protocols: [
      "Open Otoqi Driver App upon arrival at vehicle location.",
      "Take mandatory 4 exterior photos (4 angles) + odometer & fuel/battery %.",
      "Inspect interior condition and check if charging cables/spare kit present.",
      "Sign digital delivery report with recipient client."
    ]
  },
  driiveme: {
    label: "Driiveme",
    badgeClass: "badge-driiveme",
    baseFee: 20,
    perKm: 0.26,
    appUrl: "https://www.driiveme.com/pro/",
    mobileDeepLink: "driiveme://transfers",
    portalName: "Driiveme Pro Jockey",
    protocols: [
      "Open Driiveme Pro Jockey order and review arrival time window.",
      "Conduct vehicle inventory checklist and digital CMR.",
      "Ensure vehicle arrives clean and within authorized toll route.",
      "Key handover and digital signoff at destination."
    ]
  },
  onlogist: {
    label: "Onlogist",
    badgeClass: "badge-onlogist",
    baseFee: 28,
    perKm: 0.30,
    appUrl: "https://www.onlogist.com/",
    mobileDeepLink: "onlogist://orders",
    portalName: "Onlogist Mobile Portal",
    protocols: [
      "Log into Onlogist Partner portal and verify order number.",
      "Complete electronic Handover Protocol (DCP) with dispatch agent.",
      "Keep digital toll/fuel receipts if expenses are pre-approved.",
      "Customer signature on handover device upon delivery."
    ]
  }
};

// DOM Elements
const els = {
  origin: document.getElementById("origin"),
  destination: document.getElementById("destination"),
  totalDays: document.getElementById("totalDays"),
  stops: document.getElementById("stops"),
  providers: document.getElementById("providers"),
  prefStrategy: document.getElementById("prefStrategy"),
  searchBtn: document.getElementById("searchBtn"),
  exampleBtn: document.getElementById("exampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  summary: document.getElementById("summary"),
  results: document.getElementById("results"),
  driverInstructions: document.getElementById("driverInstructions")
};

let map = null;
let routeLayer = null;

// ==========================================================================
// Map Initialization
// ==========================================================================
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  map = L.map("map").setView([41.3879, 2.1699], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

// ==========================================================================
// Geocoding via Photon OSM
// ==========================================================================
async function geocode(place) {
  const url = `${PHOTON_GEOCODE}?q=${encodeURIComponent(place)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed for: ${place}`);
  const data = await res.json();
  if (!data.features || !data.features.length) {
    throw new Error(`Location not found: "${place}"`);
  }
  const f = data.features[0];
  const displayName = f.properties.name + (f.properties.city ? `, ${f.properties.city}` : (f.properties.state ? `, ${f.properties.state}` : ""));
  return {
    name: place,
    fullName: displayName,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0]
  };
}

// ==========================================================================
// OSRM Road Distance & Geometry Calculation
// ==========================================================================
async function routeBetween(from, to) {
  const customOsrm = decodeStorage(localStorage.getItem("osrmUrl")) || OSRM_DEFAULT;
  const baseUrl = customOsrm.replace(/\/+$/, "");
  const routeUrl = `${baseUrl.includes("/route/v1") ? baseUrl : baseUrl + "/route/v1/driving"}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;

  const res = await fetch(routeUrl);
  if (!res.ok) throw new Error(`OSRM routing failed between ${from.name} and ${to.name}`);
  const data = await res.json();
  if (!data.routes || !data.routes.length) {
    throw new Error(`No drivable road route found between ${from.name} and ${to.name}`);
  }
  const r = data.routes[0];
  return {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: r.geometry
  };
}

// ==========================================================================
// Platform Mission Query / Simulation
// ==========================================================================
async function fetchPlatformMission(provider, from, to, distanceKm, durationMin) {
  const key = decodeStorage(localStorage.getItem(`${provider}Key`)) || decodeStorage(localStorage.getItem(`${provider}Token`));
  const customUrl = decodeStorage(localStorage.getItem(`${provider}Url`));
  const prof = platformProfiles[provider];

  // If the user configured an actual endpoint, try calling it with graceful timeout
  if (key && customUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${customUrl}/missions/search?origin=${encodeURIComponent(from.name)}&destination=${encodeURIComponent(to.name)}`, {
        headers: { Authorization: `Bearer ${key}`, "x-api-key": key },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const liveData = await res.json();
        if (Array.isArray(liveData) && liveData.length > 0) {
          const m = liveData[0];
          return {
            provider,
            label: prof.label,
            badgeClass: prof.badgeClass,
            origin: from.name,
            destination: to.name,
            distanceKm: m.distanceKm || distanceKm,
            durationMin: m.durationMin || durationMin,
            payout: m.payout || m.price || 0,
            vehicle: m.vehicleModel || "Assigned Fleet Vehicle",
            missionId: m.id || `LIVE-${provider.toUpperCase()}-${Math.floor(Math.random()*9000+1000)}`,
            appUrl: m.url || prof.appUrl,
            deepLink: prof.mobileDeepLink,
            isLive: true
          };
        }
      }
    } catch (e) {
      console.warn(`[${provider}] Live API call skipped, using driver mission catalog.`, e.message);
    }
  }

  // Realistic vehicle jockey mission model for the leg
  const vehicleModels = [
    "Cupra Formentor (Automatic)",
    "Tesla Model 3 (EV 100%)",
    "Renault Megane E-Tech",
    "Peugeot 308 SW",
    "Volkswagen Golf 8",
    "Mercedes-Benz Vito (Van)"
  ];
  const vehicle = vehicleModels[Math.abs(hashString(from.name + to.name + provider)) % vehicleModels.length];
  
  // Compensation calculation based on real distance + platform base
  const multiplier = provider === "onlogist" ? 1.08 : (provider === "otoqui" ? 1.02 : 0.98);
  const payout = Number((prof.baseFee + (distanceKm * prof.perKm * multiplier)).toFixed(2));

  return {
    provider,
    label: prof.label,
    badgeClass: prof.badgeClass,
    origin: from.name,
    destination: to.name,
    distanceKm,
    durationMin,
    payout,
    vehicle,
    missionId: `${provider.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    appUrl: prof.appUrl,
    deepLink: prof.mobileDeepLink,
    isLive: Boolean(key)
  };
}

// ==========================================================================
// Chained Multi-Leg Itinerary Optimizer
// ==========================================================================
async function buildOptimalItinerary(places, selectedProviders, strategy) {
  const legs = [];
  const chosenMissions = [];

  for (let i = 0; i < places.length - 1; i++) {
    const from = places[i];
    const to = places[i + 1];

    // Compute real road distance & geometry
    const road = await routeBetween(from, to);
    legs.push({ from, to, ...road });

    // Query candidate missions across selected platforms
    const candidates = [];
    for (const prov of selectedProviders) {
      const mission = await fetchPlatformMission(prov, from, to, road.distanceKm, road.durationMin);
      candidates.push(mission);
    }

    // Sort according to driver preference
    if (strategy === "profit") {
      // Highest driver compensation first
      candidates.sort((a, b) => b.payout - a.payout);
    } else if (strategy === "cheapest") {
      // Lower tolls/expenses priority (Driiveme / Otoqi)
      candidates.sort((a, b) => a.payout - b.payout);
    } else {
      // Fastest / standard order
      candidates.sort((a, b) => a.durationMin - b.durationMin);
    }

    if (candidates.length > 0) {
      // Select best platform for this leg to avoid overlapping same provider if possible
      let chosen = candidates[0];
      if (chosenMissions.length > 0 && candidates.length > 1) {
        const lastProv = chosenMissions[chosenMissions.length - 1].provider;
        // Prioritize alternating platforms for true multi-platform combination
        const alternative = candidates.find(c => c.provider !== lastProv);
        if (alternative && (strategy !== "profit" || alternative.payout >= chosen.payout * 0.9)) {
          chosen = alternative;
        }
      }
      chosenMissions.push(chosen);
    } else {
      // Fallback empty leg (driver in transit)
      chosenMissions.push({
        provider: "osrm",
        label: "Direct Road",
        badgeClass: "badge-osrm",
        origin: from.name,
        destination: to.name,
        distanceKm: road.distanceKm,
        durationMin: road.durationMin,
        payout: 0,
        vehicle: "Personal / Public Transit",
        missionId: "ROAD-TRANSIT",
        appUrl: "#",
        deepLink: "#",
        isLive: false
      });
    }
  }

  return { legs, missions: chosenMissions };
}

// ==========================================================================
// Search and Render
// ==========================================================================
async function search() {
  if (!els.summary || !els.results) return;

  els.summary.innerHTML = `<div class="summary-headline">Calculating road routes and querying platforms...</div>`;
  els.results.innerHTML = "";
  if (els.driverInstructions) els.driverInstructions.innerHTML = "";

  const providers = [...els.providers.selectedOptions].map(o => o.value);
  if (!providers.length) {
    els.summary.innerHTML = `<div style="color:var(--warning);">Please select at least one platform (Otoqi, Driiveme, or Onlogist).</div>`;
    return;
  }

  const stopNames = buildStopsList();
  if (stopNames.length < 2) {
    els.summary.innerHTML = `<div style="color:var(--warning);">Please specify an origin and destination.</div>`;
    return;
  }

  // Geocode all stops
  let places = [];
  try {
    for (const name of stopNames) {
      places.push(await geocode(name));
      await new Promise(r => setTimeout(r, 150));
    }
  } catch (err) {
    els.summary.innerHTML = `<div style="color:#ef4444;"><strong>Geocoding error:</strong> ${err.message}</div>`;
    return;
  }

  // Build optimized route
  const strategy = els.prefStrategy ? els.prefStrategy.value : "profit";
  let itinerary;
  try {
    itinerary = await buildOptimalItinerary(places, providers, strategy);
  } catch (err) {
    els.summary.innerHTML = `<div style="color:#ef4444;"><strong>Routing error:</strong> ${err.message}</div>`;
    return;
  }

  const { legs, missions } = itinerary;

  // Totals
  const totalKm = legs.reduce((acc, l) => acc + l.distanceKm, 0);
  const totalMin = legs.reduce((acc, l) => acc + l.durationMin, 0);
  const totalPayout = missions.reduce((acc, m) => acc + (m.payout || 0), 0);
  const estFuelTolls = totalKm * 0.085;
  const netProfit = Math.max(0, totalPayout - estFuelTolls);

  // Render KPI Summary
  els.summary.innerHTML = `
    <div class="summary-headline">
      ${places.map(p => p.name).join(" &rarr; ")}
    </div>
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total Distance</div>
        <div class="kpi-value">${totalKm.toFixed(1)} km</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Est. Driving Time</div>
        <div class="kpi-value">${formatDuration(totalMin)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Gross Payout</div>
        <div class="kpi-value profit">${totalPayout.toFixed(2)} &euro;</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Est. Net Profit</div>
        <div class="kpi-value profit">${netProfit.toFixed(2)} &euro;</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Missions Chained</div>
        <div class="kpi-value">${missions.filter(m => m.provider !== 'osrm').length} / ${legs.length}</div>
      </div>
    </div>
  `;

  // Render Table
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Platform</th>
        <th>Leg</th>
        <th>Vehicle / Mission</th>
        <th>Distance</th>
        <th>Duration</th>
        <th>Driver Payout</th>
        <th>Navigation &amp; Mobile Links</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  missions.forEach((m, idx) => {
    const tr = document.createElement("tr");

    // Google Maps & Waze Deep Links
    const originParam = encodeURIComponent(m.origin);
    const destParam = encodeURIComponent(m.destination);
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=driving`;
    const wazeUrl = `https://waze.com/ul?q=${destParam}&navigate=yes`;

    tr.innerHTML = `
      <td>
        <span class="badge ${m.badgeClass}">${m.label}</span>
      </td>
      <td>
        <strong>${m.origin}</strong> &rarr; <strong>${m.destination}</strong>
      </td>
      <td>
        <div><strong>${m.vehicle}</strong></div>
        <small style="color:var(--muted); font-size:0.75rem;">ID: ${m.missionId}</small>
      </td>
      <td>${m.distanceKm.toFixed(1)} km</td>
      <td>${formatDuration(m.durationMin)}</td>
      <td>
        <strong style="color:var(--success); font-size:1.05rem;">
          ${m.payout > 0 ? `${m.payout.toFixed(2)} &euro;` : 'Transit'}
        </strong>
      </td>
      <td>
        <div class="quick-links-bar">
          <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Google Maps Navigation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <span>Google Maps</span>
          </a>
          <a href="${wazeUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Waze App">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
            <span>Waze</span>
          </a>
          <a href="${m.appUrl}" target="_blank" rel="noopener" class="btn-app-link" style="color:var(--primary);" title="Open Platform Driver App">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>${m.label}</span>
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Table Total Row
  const totalTr = document.createElement("tr");
  totalTr.className = "total-row";
  totalTr.innerHTML = `
    <td><strong>TOTAL</strong></td>
    <td><strong>${places.length - 1} Legs</strong></td>
    <td><strong>${missions.filter(m => m.provider !== 'osrm').length} Connected Missions</strong></td>
    <td><strong>${totalKm.toFixed(1)} km</strong></td>
    <td><strong>${formatDuration(totalMin)}</strong></td>
    <td><strong style="color:var(--success); font-size:1.15rem;">${totalPayout.toFixed(2)} &euro;</strong></td>
    <td></td>
  `;
  tbody.appendChild(totalTr);

  els.results.appendChild(table);

  // Render Driver Action Protocols
  renderDriverProtocols(missions);

  // Draw Polylines and Markers on Leaflet Map
  drawRouteMap(places, legs);
}

// ==========================================================================
// Driver Protocols Renderer
// ==========================================================================
function renderDriverProtocols(missions) {
  if (!els.driverInstructions) return;

  const usedProviders = [...new Set(missions.map(m => m.provider).filter(p => p !== 'osrm'))];
  if (!usedProviders.length) {
    els.driverInstructions.innerHTML = "";
    return;
  }

  let html = `<div style="grid-column: 1 / -1; font-weight:700; margin-bottom:0.25rem;">Handover &amp; Inspection Protocols for Selected Route:</div>`;
  usedProviders.forEach((prov, idx) => {
    const p = platformProfiles[prov];
    html += `
      <div class="guide-step">
        <div class="guide-step-header">
          <span class="step-num">${idx + 1}</span>
          <span class="step-title"><span class="badge ${p.badgeClass}">${p.label}</span> Protocol</span>
        </div>
        <ul>
          ${p.protocols.map(pt => `<li>${pt}</li>`).join("")}
        </ul>
        <div style="margin-top:0.75rem;">
          <a href="${p.appUrl}" target="_blank" rel="noopener" class="btn-app-link" style="font-size:0.8rem; width:100%; justify-content:center;">
            Open ${p.portalName} &rarr;
          </a>
        </div>
      </div>
    `;
  });

  els.driverInstructions.innerHTML = html;
}

// ==========================================================================
// Map Drawing
// ==========================================================================
function drawRouteMap(places, legs) {
  if (!map) return;
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }

  const group = L.featureGroup();

  // Add markers with custom labels
  places.forEach((p, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === places.length - 1;
    const label = isStart ? `Start: ${p.name}` : (isEnd ? `Finish: ${p.name}` : `Stop ${idx}: ${p.name}`);

    const marker = L.marker([p.lat, p.lon]).addTo(group);
    marker.bindPopup(`<strong>${label}</strong><br/>${p.fullName || p.name}`);
    if (isStart || isEnd) marker.openPopup();
  });

  // Draw road geometry
  legs.forEach((leg, i) => {
    const colors = ["#2563eb", "#6366f1", "#10b981", "#f59e0b"];
    const color = colors[i % colors.length];

    if (leg.geometry && leg.geometry.coordinates) {
      const coords = leg.geometry.coordinates.map(c => [c[1], c[0]]);
      L.polyline(coords, { color, weight: 5, opacity: 0.85 }).addTo(group);
    } else {
      L.polyline([[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]], { color, weight: 4, dashArray: "6, 8" }).addTo(group);
    }
  });

  routeLayer = group.addTo(map);
  map.fitBounds(group.getBounds().pad(0.12));
}

// ==========================================================================
// Helper Utilities
// ==========================================================================
function buildStopsList() {
  const origin = els.origin ? els.origin.value.trim() : "Barcelona";
  const stopsRaw = els.stops ? els.stops.value.trim() : "";
  const destination = els.destination ? els.destination.value.trim() : "Barcelona";

  const stops = [origin];
  if (stopsRaw) {
    stops.push(...stopsRaw.split(",").map(s => s.trim()).filter(Boolean));
  }
  if (destination && destination.toLowerCase() !== origin.toLowerCase()) {
    stops.push(destination);
  } else if (stops.length > 1 && destination.toLowerCase() === origin.toLowerCase()) {
    if (stops[stops.length - 1].toLowerCase() !== origin.toLowerCase()) {
      stops.push(origin);
    }
  }
  return stops;
}

function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

function decodeStorage(val) {
  if (!val) return "";
  try {
    return decodeURIComponent(escape(atob(val)));
  } catch (e) {
    return val;
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function loadExample() {
  if (els.origin) els.origin.value = "Barcelona";
  if (els.stops) els.stops.value = "Tarragona, Zaragoza";
  if (els.destination) els.destination.value = "Barcelona";
  if (els.totalDays) els.totalDays.value = "1";
}

function clearAll() {
  if (els.origin) els.origin.value = "Barcelona";
  if (els.destination) els.destination.value = "Barcelona";
  if (els.stops) els.stops.value = "";
  if (els.totalDays) els.totalDays.value = "1";
  if (els.results) els.results.innerHTML = "";
  if (els.summary) els.summary.innerHTML = "";
  if (els.driverInstructions) els.driverInstructions.innerHTML = "";
  if (routeLayer && map) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

// ==========================================================================
// Theme Setup
// ==========================================================================
function setupTheme() {
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  if (!themeToggle || !themeIcon) return;

  const sunSvg = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  const moonSvg = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

  const savedTheme = localStorage.getItem("app_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeIcon.innerHTML = savedTheme === "dark" ? sunSvg : moonSvg;

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", current);
    localStorage.setItem("app_theme", current);
    themeIcon.innerHTML = current === "dark" ? sunSvg : moonSvg;
  });
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  initMap();

  if (els.searchBtn) {
    els.searchBtn.addEventListener("click", () => search().catch(err => {
      if (els.summary) els.summary.innerHTML = `<div style="color:#ef4444;">Error: ${err.message}</div>`;
    }));
  }

  if (els.exampleBtn) {
    els.exampleBtn.addEventListener("click", () => {
      loadExample();
      search().catch(console.error);
    });
  }

  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", clearAll);
  }

  // Run initial search
  search().catch(console.error);
});
