/**
 * OptiRoute / Real Route Finder
 * Multi-platform Vehicle Jockey & Mission Planner (Otoqi, Driiveme, Onlogist)
 * Realistic operational shifts, EU driving breaks, and candidate corridor optimization
 * Developed in Barcelona by xarop.com
 */

// API Endpoints
const OSRM_DEFAULT = "https://router.project-osrm.org/route/v1/driving";

// Platform Pricing Profiles for Jockey Relocations
const platformProfiles = {
  otoqui: {
    label: "Otoqi",
    badgeClass: "badge-otoqi",
    baseFee: 25,
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
    baseFee: 22,
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
    baseFee: 30,
    perKm: 0.31,
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

function getSelectedProviders() {
  const selected = [];
  const pOtoqui = document.getElementById("prov_otoqui");
  const pDriiveme = document.getElementById("prov_driiveme");
  const pOnlogist = document.getElementById("prov_onlogist");

  if (pOtoqui && pOtoqui.checked) selected.push("otoqui");
  if (pDriiveme && pDriiveme.checked) selected.push("driiveme");
  if (pOnlogist && pOnlogist.checked) selected.push("onlogist");
  return selected;
}

function setupPlatformCheckboxes() {
  document.querySelectorAll(".platform-choice").forEach(card => {
    const checkbox = card.querySelector("input[type='checkbox']");
    if (!checkbox) return;

    const updateState = () => {
      if (checkbox.checked) {
        card.classList.add("checked");
      } else {
        card.classList.remove("checked");
      }
    };

    checkbox.addEventListener("change", updateState);
    updateState();
  });
}

// DOM Elements
const els = {
  origin: document.getElementById("origin"),
  destination: document.getElementById("destination"),
  totalDays: document.getElementById("totalDays"),
  stops: document.getElementById("stops"),
  prefStrategy: document.getElementById("prefStrategy"),
  searchBtn: document.getElementById("searchBtn"),
  exampleBtn: document.getElementById("exampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  summary: document.getElementById("summary"),
  results: document.getElementById("results"),
  driverInstructions: document.getElementById("driverInstructions"),
  missionPaste: document.getElementById("missionPaste"),
  parseMissionsBtn: document.getElementById("parseMissionsBtn"),
  clearPasteBtn: document.getElementById("clearPasteBtn"),
  recentSearches: document.getElementById("recentSearches")
};

let map = null;
let routeLayer = null;
let currentComputedOptions = [];
let activeOptionIndex = 0;

// Cache for geocoding and road legs to ensure instant calculations
const geocodeCache = new Map();
const roadRouteCache = new Map();

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
// Geocoding via Nominatim (OpenStreetMap) – precise address preferred over generic city
// ==========================================================================
async function geocode(place) {
  const trimmed = place.trim();
  const cacheKey = trimmed.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // If input is already GPS coordinates, reverse-geocode to get a precise address
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    try {
      const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const revRes = await fetch(revUrl, { headers: { "Accept-Language": "es", "User-Agent": "RealRouteFinder/1.0" } });
      const revData = await revRes.json();
      const addr = revData.address || {};
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || trimmed;
      const fullAddress = revData.display_name || trimmed;
      const result = { name: city, city, fullName: fullAddress.split(",").slice(0, 3).join(",").trim(), address: fullAddress, lat, lon, isPrecise: true };
      geocodeCache.set(cacheKey, result);
      return result;
    } catch (e) {
      const result = { name: trimmed, city: trimmed, fullName: trimmed, address: trimmed, lat, lon };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }

  const genericTypes = new Set(["city", "town", "municipality", "administrative", "state", "country", "county", "region", "province", "village", "hamlet"]);

  const fetchResults = async (url) => {
    const res = await fetch(url, { headers: { "Accept-Language": "es", "User-Agent": "RealRouteFinder/1.0" } });
    if (!res.ok) throw new Error(`Geocoding failed for: ${trimmed}`);
    return res.json();
  };

  let data = [];
  try {
    const primaryUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&countrycodes=es&format=json&limit=8&addressdetails=1`;
    data = await fetchResults(primaryUrl);
  } catch (e) {
    // ignore, try fallback
  }

  if (!data || !data.length) {
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=8&addressdetails=1`;
    const fallbackData = await fetchResults(fallbackUrl);
    if (!fallbackData || !fallbackData.length) throw new Error(`Location not found: "${trimmed}"`);
    data = fallbackData;
  }

  const precise = data.find(r => !genericTypes.has(r.type) && !genericTypes.has(r.addresstype));
  const cityResult = data.find(r => r.type === "city" || r.addresstype === "city" || r.type === "town" || r.addresstype === "town");
  const best = precise || cityResult || data[0];

  const isPrecise = !genericTypes.has(best.type) && !genericTypes.has(best.addresstype);

  const addr = best.address || {};
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || trimmed;
  const fullAddress = best.display_name || trimmed;
  const shortAddress = fullAddress.split(",").slice(0, 3).join(",").trim();

  const result = {
    name: trimmed,
    city,
    fullName: shortAddress,
    address: fullAddress,
    lat: parseFloat(best.lat),
    lon: parseFloat(best.lon),
    isPrecise
  };
  geocodeCache.set(cacheKey, result);
  return result;
}

// ==========================================================================
// OSRM Road Distance & Geometry Calculation with Caching
// ==========================================================================
async function routeBetween(from, to) {
  const cacheKey = `${from.name}->${to.name}`;
  if (roadRouteCache.has(cacheKey)) {
    return roadRouteCache.get(cacheKey);
  }

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
  const result = {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: r.geometry
  };
  roadRouteCache.set(cacheKey, result);
  return result;
}

// ==========================================================================
// Platform Mission Query / Simulation
// ==========================================================================
async function fetchPlatformMission(provider, from, to, distanceKm, durationMin) {
  const key = decodeStorage(localStorage.getItem(`${provider}Key`)) || decodeStorage(localStorage.getItem(`${provider}Token`));
  const customUrl = decodeStorage(localStorage.getItem(`${provider}Url`));
  const prof = platformProfiles[provider];

  if (key && customUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const url = `${customUrl}/missions/search?origin=${encodeURIComponent(from.name)}&destination=${encodeURIComponent(to.name)}&originLat=${from.lat}&originLon=${from.lon}&destLat=${to.lat}&destLon=${to.lon}`;
      const res = await fetch(url, {
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
            originCity: m.originCity || m.origin_city || from.city || from.name,
            destCity: m.destCity || m.dest_city || m.destinationCity || to.city || to.name,
            originAddress: m.originAddress || m.origin_address || m.origin || from.address || from.fullName || from.name,
            destinationAddress: m.destinationAddress || m.destination_address || m.destination || to.address || to.fullName || to.name,
            originLat: (m.originLat != null ? m.originLat : m.origin_lat) ?? from.lat,
            originLon: (m.originLon != null ? m.originLon : m.origin_lon) ?? from.lon,
            destLat: (m.destLat != null ? m.destLat : m.dest_lat) ?? to.lat,
            destLon: (m.destLon != null ? m.destLon : m.dest_lon) ?? to.lon,
            distanceKm: m.distanceKm || distanceKm,
            durationMin: m.durationMin || durationMin,
            payout: m.payout || m.price || 0,
            vehicle: m.vehicleModel || "Assigned Fleet Vehicle",
            missionId: m.id || `${provider.slice(0, 3).toUpperCase()}-${Math.floor(Math.random()*9000+1000)}`,
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

  const vehicleModels = [
    "Cupra Formentor (Automatic)",
    "Tesla Model 3 (EV 100%)",
    "Renault Megane E-Tech",
    "Peugeot 308 SW",
    "Volkswagen Golf 8",
    "Mercedes-Benz Vito (Van)"
  ];
  const vehicle = vehicleModels[Math.abs(hashString(from.name + to.name + provider)) % vehicleModels.length];
  
  const multiplier = provider === "onlogist" ? 1.08 : (provider === "otoqui" ? 1.02 : 0.98);
  const payout = Number((prof.baseFee + (distanceKm * prof.perKm * multiplier)).toFixed(2));

  return {
    provider,
    label: prof.label,
    badgeClass: prof.badgeClass,
    origin: from.name,
    destination: to.name,
    originCity: from.city || from.name,
    destCity: to.city || to.name,
    originAddress: from.isPrecise ? (from.address || from.fullName || from.name) : from.name,
    destinationAddress: to.isPrecise ? (to.address || to.fullName || to.name) : to.name,
    originLat: from.lat,
    originLon: from.lon,
    destLat: to.lat,
    destLon: to.lon,
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
// Realistic Operational Metrics & Shift Constraints
// ==========================================================================
function calculateRealisticMetrics(legs, missions, userSpecifiedDays, isMultiDayAlternative = false) {
  const drivingKm = legs.reduce((acc, l) => acc + l.distanceKm, 0);
  const drivingMin = legs.reduce((acc, l) => acc + l.durationMin, 0);

  // Inspections: 25 min check-in + 20 min handover per mission = 45 min
  const missionsCount = missions.filter(m => m.provider !== 'osrm').length || legs.length;
  const inspectionMin = missionsCount * 45;

  // Inter-mission city transit: 35 min
  const transitMin = Math.max(0, (missionsCount - 1) * 35);

  // Mandatory EU driving breaks (45 min break after 4.5h driving)
  let breakMin = 0;
  if (drivingMin > 270) breakMin += 45;
  if (drivingMin > 510) breakMin += 45;

  // Total workday shift in minutes
  const totalShiftMin = Math.round(drivingMin + inspectionMin + transitMin + breakMin);

  // Calculate required days:
  // If user says 1 day, maximum acceptable shift for 1 single day is 15h (900 min)
  let effectiveDays = userSpecifiedDays;
  if (isMultiDayAlternative) {
    // Spread across 2 or more days so that daily driving does not exceed 8-9h
    effectiveDays = Math.max(2, Math.ceil(totalShiftMin / (9 * 60)));
  }

  // Accommodation / Hotel cost: 65 € per night when trip spans more than 1 day
  const hotelNights = Math.max(0, effectiveDays - 1);
  const hotelCost = hotelNights * 65.00;

  // Financials
  const grossPayout = missions.reduce((acc, m) => acc + (m.payout || 0), 0);
  const estFuelTolls = drivingKm * 0.085;
  const netProfit = Math.max(0, grossPayout - estFuelTolls - hotelCost);
  const hourlyNet = totalShiftMin > 0 ? (netProfit / (totalShiftMin / 60)) : 0;

  // Feasibility criteria:
  // For 1 day: STRICT MAX 15h (900 min) and MAX ~850 km
  let isFeasible = false;
  if (effectiveDays === 1) {
    isFeasible = (totalShiftMin <= 15 * 60) && (drivingKm <= 850);
  } else {
    isFeasible = (totalShiftMin <= effectiveDays * 11 * 60) && (drivingKm <= effectiveDays * 650);
  }

  return {
    drivingKm,
    drivingMin,
    inspectionMin,
    transitMin,
    breakMin,
    totalShiftMin,
    grossPayout,
    estFuelTolls,
    hotelNights,
    hotelCost,
    netProfit,
    hourlyNet,
    effectiveDays,
    isFeasible,
    isMultiDayAlternative
  };
}

// ==========================================================================
// Candidate Sequence Evaluator
// ==========================================================================
async function evaluateStopSequence(places, selectedProviders, strategy, totalDays, isMultiDay = false) {
  const legs = [];
  const chosenMissions = [];

  for (let i = 0; i < places.length - 1; i++) {
    const from = places[i];
    const to = places[i + 1];

    const road = await routeBetween(from, to);
    legs.push({ from, to, ...road });

    const candidates = [];
    for (const prov of selectedProviders) {
      const mission = await fetchPlatformMission(prov, from, to, road.distanceKm, road.durationMin);
      candidates.push(mission);
    }

    if (strategy === "profit") {
      candidates.sort((a, b) => b.payout - a.payout);
    } else if (strategy === "cheapest") {
      candidates.sort((a, b) => a.payout - b.payout);
    } else {
      candidates.sort((a, b) => a.durationMin - b.durationMin);
    }

    if (candidates.length > 0) {
      let chosen = candidates[0];
      if (chosenMissions.length > 0 && candidates.length > 1) {
        const lastProv = chosenMissions[chosenMissions.length - 1].provider;
        const alternative = candidates.find(c => c.provider !== lastProv);
        if (alternative && (strategy !== "profit" || alternative.payout >= chosen.payout * 0.9)) {
          chosen = alternative;
        }
      }
      chosenMissions.push(chosen);
    } else {
      chosenMissions.push({
        provider: "osrm",
        label: "Direct Road",
        badgeClass: "badge-osrm",
        origin: from.name,
        destination: to.name,
        originCity: from.city || from.name,
        destCity: to.city || to.name,
        originAddress: from.isPrecise ? (from.address || from.fullName || from.name) : from.name,
        destinationAddress: to.isPrecise ? (to.address || to.fullName || to.name) : to.name,
        originLat: from.lat,
        originLon: from.lon,
        destLat: to.lat,
        destLon: to.lon,
        distanceKm: road.distanceKm,
        durationMin: road.durationMin,
        payout: 0,
        vehicle: "Personal / Public Transit",
        missionId: "TRANSIT",
        appUrl: "#",
        deepLink: "#",
        isLive: false
      });
    }
  }

  const metrics = calculateRealisticMetrics(legs, chosenMissions, totalDays, isMultiDay);
  return { places, legs, missions: chosenMissions, metrics };
}

// ==========================================================================
// Smart Route Generator with 1-Day Shortening & Multi-Day Alternatives
// ==========================================================================
async function generateSmartRouteOptions(originPlace, destPlace, candidateStops, selectedProviders, strategy, totalDays) {
  const isLoop = originPlace.name.toLowerCase() === destPlace.name.toLowerCase();
  const options1Day = [];
  const optionsMultiDay = [];

  // Generate sub-route candidate paths
  const candidatePaths1Day = [];
  const candidatePathsMulti = [];

  if (candidateStops.length === 0) {
    if (!isLoop) {
      candidatePaths1Day.push([originPlace, destPlace]);
    } else {
      const defaultStop = await geocode("Tarragona");
      candidatePaths1Day.push([originPlace, defaultStop, destPlace]);
    }
  } else if (candidateStops.length === 1) {
    candidatePaths1Day.push([originPlace, candidateStops[0], destPlace]);
  } else {
    // Multiple stops:
    // 1. Single-stop corridors (always tested for 1-day feasibility)
    for (let i = 0; i < candidateStops.length; i++) {
      candidatePaths1Day.push([originPlace, candidateStops[i], destPlace]);
    }

    // 2. Two-stop loops
    for (let i = 0; i < candidateStops.length; i++) {
      for (let j = 0; j < candidateStops.length; j++) {
        if (i !== j) {
          candidatePaths1Day.push([originPlace, candidateStops[i], candidateStops[j], destPlace]);
        }
      }
    }

    // 3. Full candidate circuit (if > 1 stop, always evaluate as a multi-day option with hotel!)
    candidatePathsMulti.push([originPlace, ...candidateStops, destPlace]);
  }

  // Deduplicate 1-day candidate paths
  const seenKeys = new Set();
  const uniquePaths1Day = [];
  for (const path of candidatePaths1Day) {
    const key = path.map(p => p.name).join("->");
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniquePaths1Day.push(path);
    }
  }

  // Evaluate 1-day candidate paths
  for (const path of uniquePaths1Day.slice(0, 10)) {
    try {
      const evaluated = await evaluateStopSequence(path, selectedProviders, strategy, totalDays, false);
      if (evaluated.metrics.isFeasible) {
        options1Day.push(evaluated);
      } else if (totalDays === 1) {
        // If it exceeded 15h, also evaluate as multi-day alternative
        const multiEval = await evaluateStopSequence(path, selectedProviders, strategy, totalDays, true);
        optionsMultiDay.push(multiEval);
      }
    } catch (e) {
      console.warn("Path evaluation error:", e.message);
    }
  }

  // Evaluate multi-day candidate circuits (e.g. all stops with hotel)
  for (const path of candidatePathsMulti) {
    try {
      const multiEval = await evaluateStopSequence(path, selectedProviders, strategy, totalDays, true);
      optionsMultiDay.push(multiEval);
    } catch (e) {
      console.warn("Multi-day path error:", e.message);
    }
  }

  // Sort 1-day options by net profit and hourly efficiency
  options1Day.sort((a, b) => (b.metrics.netProfit * 1.4 + b.metrics.hourlyNet * 8) - (a.metrics.netProfit * 1.4 + a.metrics.hourlyNet * 8));

  // Sort multi-day options
  optionsMultiDay.sort((a, b) => b.metrics.netProfit - a.metrics.netProfit);

  // Combine results:
  // Option 1: Top 1-day feasible route (under 15h, realistic)
  // Option 2: Multi-day route with hotel (if exists) or secondary 1-day route
  // Option 3: Additional alternative
  const finalOptions = [];
  if (options1Day.length > 0) {
    finalOptions.push(options1Day[0]);
  }

  if (optionsMultiDay.length > 0) {
    finalOptions.push(optionsMultiDay[0]);
  }

  if (options1Day.length > 1) {
    finalOptions.push(options1Day[1]);
  } else if (optionsMultiDay.length > 1 && finalOptions.length < 3) {
    finalOptions.push(optionsMultiDay[1]);
  }

  if (finalOptions.length === 0) {
    // Fallback if everything was too tight
    const fallbackPath = [originPlace, destPlace];
    const fallback = await evaluateStopSequence(fallbackPath, selectedProviders, strategy, totalDays, false);
    finalOptions.push(fallback);
  }

  return finalOptions;
}

// ==========================================================================
// Search and Render
// ==========================================================================
async function search() {
  if (!els.summary || !els.results) return;

  els.summary.innerHTML = `<div class="summary-headline">Calculating road routes and querying platforms...</div>`;
  els.results.innerHTML = "";
  if (els.driverInstructions) els.driverInstructions.innerHTML = "";

  const providers = getSelectedProviders();
  if (!providers.length) {
    els.summary.innerHTML = `<div style="color:var(--warning);">Please select at least one platform (Otoqi, Driiveme, or Onlogist).</div>`;
    return;
  }

  const originName = els.origin ? els.origin.value.trim() : "Barcelona";
  const destName = els.destination ? els.destination.value.trim() : "Barcelona";
  const stopsRaw = els.stops ? els.stops.value.trim() : "";
  const totalDays = Math.max(1, parseInt(els.totalDays ? els.totalDays.value : "1", 10) || 1);
  const strategy = els.prefStrategy ? els.prefStrategy.value : "profit";

  if (!originName || !destName) {
    els.summary.innerHTML = `<div style="color:var(--warning);">Please specify an origin and destination.</div>`;
    return;
  }

  saveRecentSearch(originName, destName, stopsRaw, totalDays, strategy);

  // Geocode Origin & Destination
  let originPlace, destPlace;
  try {
    originPlace = await geocode(originName);
    destPlace = await geocode(destName);
  } catch (err) {
    els.summary.innerHTML = `<div style="color:#ef4444;"><strong>Geocoding error:</strong> ${err.message}</div>`;
    return;
  }

  // Geocode intermediate candidate orientation stops
  const candidateStops = [];
  if (stopsRaw) {
    const rawList = stopsRaw.split(",").map(s => s.trim()).filter(Boolean);
    for (const s of rawList) {
      if (s.toLowerCase() !== originName.toLowerCase() && s.toLowerCase() !== destName.toLowerCase()) {
        try {
          candidateStops.push(await geocode(s));
          await new Promise(r => setTimeout(r, 80));
        } catch (e) {
          console.warn(`Stop ${s} ignored:`, e.message);
        }
      }
    }
  }

  // Compute Smart Route Options
  try {
    currentComputedOptions = await generateSmartRouteOptions(originPlace, destPlace, candidateStops, providers, strategy, totalDays);
    activeOptionIndex = 0;
    renderActiveOption(totalDays, candidateStops.length);
  } catch (err) {
    els.summary.innerHTML = `<div style="color:#ef4444;"><strong>Routing error:</strong> ${err.message}</div>`;
  }
}

// ==========================================================================
// Render Selected Route Option
// ==========================================================================
function renderActiveOption(totalDays, totalCandidateStopsCount) {
  if (!currentComputedOptions.length) return;
  const opt = currentComputedOptions[activeOptionIndex];
  const { places, legs, missions, metrics } = opt;

  // 1. Alternative Route Tabs (1-Day Loop vs Multi-Day with Hotel)
  let altsHtml = "";
  if (currentComputedOptions.length > 1) {
    altsHtml = `
      <div class="route-alternatives-bar">
        ${currentComputedOptions.slice(0, 3).map((candidate, idx) => {
          const isActive = idx === activeOptionIndex;
          const isMulti = candidate.metrics.isMultiDayAlternative;
          let label = "";
          if (!isMulti) {
            label = idx === 0 ? "Option 1 (1-Day Feasible Loop)" : `Option ${idx + 1} (1-Day)`;
          } else {
            label = `Option ${idx + 1} (${candidate.metrics.effectiveDays} Days + Hotel)`;
          }
          const summaryStr = `${candidate.metrics.drivingKm.toFixed(0)} km · ${formatDuration(candidate.metrics.totalShiftMin)}`;
          return `
            <button class="route-alt-tab ${isActive ? 'active' : ''}" data-opt-idx="${idx}">
              ${label}: ${candidate.places.slice(1, -1).map(p => p.city || p.name).join(" → ") || candidate.places[1]?.city || candidate.places[1]?.name || 'Direct'} (${summaryStr})
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  // 2. Realistic Day Limit Alert
  let dayLimitAlert = "";
  if (metrics.isMultiDayAlternative) {
    dayLimitAlert = `
      <div class="alert-day-limit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div>
          <strong>Multi-Day Alternative (${metrics.effectiveDays} Days):</strong> This circuit spans ${metrics.drivingKm.toFixed(0)} km and requires ${formatDuration(metrics.totalShiftMin)} total workday. It is split over ${metrics.effectiveDays} days with <strong>${metrics.hotelNights} hotel night (-${metrics.hotelCost.toFixed(2)} €)</strong> deducted from net earnings to ensure driver safety and legal compliance.
        </div>
      </div>
    `;
  } else if (totalCandidateStopsCount > (places.length - 2) && totalDays === 1) {
    dayLimitAlert = `
      <div class="alert-day-limit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div>
          <strong>Optimized for 1 Day (&le; 15h Workday):</strong> The route was automatically trimmed to the most profitable corridor (${metrics.drivingKm.toFixed(0)} km) to keep total working time realistic (${formatDuration(metrics.totalShiftMin)} including handovers and breaks). Click the multi-day tab above if you prefer covering all destinations over 2+ days.
        </div>
      </div>
    `;
  }

  // Hotel allowance display in breakdown
  const hotelHtml = metrics.hotelCost > 0 ? `
    <div class="time-breakdown-item">
      <div class="time-breakdown-label" data-i18n="kpi_hotel">Hotel / Pernoctació</div>
      <div class="time-breakdown-val" style="color:#ef4444;">-${metrics.hotelCost.toFixed(2)} &euro; (${metrics.hotelNights} nit/s)</div>
    </div>
  ` : `
    <div class="time-breakdown-item">
      <div class="time-breakdown-label">Est. Fuel &amp; Tolls</div>
      <div class="time-breakdown-val" style="color:var(--muted);">${metrics.estFuelTolls.toFixed(2)} &euro;</div>
    </div>
  `;

  // 3. Render KPI Summary & Operational Time Breakdown
  const shiftDisplay = metrics.effectiveDays > 1 ? `${formatDuration(metrics.totalShiftMin)} (${metrics.effectiveDays} days)` : formatDuration(metrics.totalShiftMin);

  els.summary.innerHTML = `
    ${altsHtml}
    <div class="summary-headline">
      ${places.map(p => p.city || p.name).join(" &rarr; ")}
    </div>
    
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total Distance</div>
        <div class="kpi-value">${metrics.drivingKm.toFixed(1)} km</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label" data-i18n="kpi_total_shift">Total Workday</div>
        <div class="kpi-value">${shiftDisplay}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Gross Payout</div>
        <div class="kpi-value profit">${metrics.grossPayout.toFixed(2)} &euro;</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Est. Net Profit</div>
        <div class="kpi-value profit">${metrics.netProfit.toFixed(2)} &euro;</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label" data-i18n="kpi_net_hourly">Net Hourly Rate</div>
        <div class="kpi-value profit">~${metrics.hourlyNet.toFixed(2)} &euro;/h</div>
      </div>
    </div>

    <!-- Realistic Operational Schedule Breakdown -->
    <div class="time-breakdown-box">
      <div class="time-breakdown-item">
        <div class="time-breakdown-label" data-i18n="kpi_driving_time">Driving Time</div>
        <div class="time-breakdown-val">${formatDuration(metrics.drivingMin)} (${metrics.drivingKm.toFixed(0)} km)</div>
      </div>
      <div class="time-breakdown-item">
        <div class="time-breakdown-label" data-i18n="kpi_inspections">Check-in &amp; Handovers</div>
        <div class="time-breakdown-val">${formatDuration(metrics.inspectionMin)} (${missions.length} legs &times; 45m)</div>
      </div>
      <div class="time-breakdown-item">
        <div class="time-breakdown-label" data-i18n="kpi_breaks_transit">Breaks &amp; Transit</div>
        <div class="time-breakdown-val">${formatDuration(metrics.breakMin + metrics.transitMin)}</div>
      </div>
      ${hotelHtml}
    </div>

    ${dayLimitAlert}
  `;

  // Attach alternative tabs event listeners
  document.querySelectorAll(".route-alt-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      activeOptionIndex = parseInt(tab.getAttribute("data-opt-idx"), 10) || 0;
      renderActiveOption(totalDays, totalCandidateStopsCount);
    });
  });

  // 4. Render Desktop Table & Mobile Leg Cards
  els.results.innerHTML = "";

  const desktopWrapper = document.createElement("div");
  desktopWrapper.className = "table-wrapper desktop-only";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Leg &amp; Route</th>
        <th>Distance &amp; Time</th>
        <th>Mission Ref</th>
        <th>Driver Payout</th>
        <th>Navigation</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const mobileWrapper = document.createElement("div");
  mobileWrapper.className = "mobile-leg-cards mobile-only";

  missions.forEach((m) => {
    const originCoord = (m.originLat != null && m.originLon != null) ? `${m.originLat},${m.originLon}` : null;
    const destCoord = (m.destLat != null && m.destLon != null) ? `${m.destLat},${m.destLon}` : null;
    const originParam = originCoord ? originCoord : encodeURIComponent(m.origin);
    const destParam = destCoord ? destCoord : encodeURIComponent(m.destination);
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=driving`;
    const wazeUrl = `https://waze.com/ul?q=${destParam}&navigate=yes`;

    const originAddr = (m.originAddress && m.originAddress !== m.origin) ? m.originAddress : '';
    const destAddr = (m.destinationAddress && m.destinationAddress !== m.destination) ? m.destinationAddress : '';
    const addrLine = (originAddr || destAddr)
      ? `<div style="font-size:0.78rem; color:var(--muted);">${originAddr || m.origin} &rarr; ${destAddr || m.destination}</div>`
      : '';

    const refCode = m.missionId.startsWith("#") ? m.missionId : `#${m.missionId}`;
    const unifiedBadge = `
      <a href="${m.appUrl}" target="_blank" rel="noopener" class="badge ${m.badgeClass} badge-link" title="Open in ${m.label} Driver App">
        <span>${refCode}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    `;

    // A. Desktop Row
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:700; font-size:0.95rem;">${m.originCity || m.origin} &rarr; ${m.destCity || m.destination}</div>
        ${addrLine}
      </td>
      <td>
        <div><strong>${m.distanceKm.toFixed(1)} km</strong></div>
        <small style="color:var(--muted);">${formatDuration(m.durationMin)}</small>
      </td>
      <td>
        <div>${unifiedBadge}</div>
        <small style="color:var(--muted); font-size:0.8rem;">${m.vehicle}</small>
      </td>
      <td>
        <strong style="color:var(--success); font-size:1.15rem;">
          ${m.payout > 0 ? `${m.payout.toFixed(2)} &euro;` : 'Transit'}
        </strong>
      </td>
      <td>
        <div class="quick-links-bar" style="margin-top:0;">
          <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Google Maps Navigation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            <span>Maps</span>
          </a>
          <a href="${wazeUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Waze App">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
            <span>Waze</span>
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // B. Mobile Leg Card
    const card = document.createElement("div");
    card.className = "leg-card";
    card.innerHTML = `
      <div class="leg-card-header">
        <div>
          <div class="leg-route">${m.originCity || m.origin} &rarr; ${m.destCity || m.destination}</div>
          ${addrLine}
        </div>
        <div class="leg-payout">${m.payout > 0 ? `${m.payout.toFixed(2)} &euro;` : 'Transit'}</div>
      </div>

      <div class="leg-meta">
        <div class="leg-meta-item">
          <strong>${m.distanceKm.toFixed(1)} km</strong>
          <span>&middot;</span>
          <span>${formatDuration(m.durationMin)}</span>
        </div>
        <div>
          ${unifiedBadge}
        </div>
      </div>

      <div style="font-size:0.85rem; color:var(--muted);">
        ${m.vehicle}
      </div>

      <div class="leg-actions">
        <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Google Maps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Google Maps</span>
        </a>
        <a href="${wazeUrl}" target="_blank" rel="noopener" class="btn-app-link" title="Open Waze">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
          <span>Waze</span>
        </a>
      </div>
    `;
    mobileWrapper.appendChild(card);
  });

  // Desktop Total Row
  const totalTr = document.createElement("tr");
  totalTr.className = "total-row";
  totalTr.innerHTML = `
    <td><strong>TOTAL</strong> (${places.length - 1} Legs)</td>
    <td><strong>${metrics.drivingKm.toFixed(1)} km &middot; ${formatDuration(metrics.drivingMin)}</strong></td>
    <td><strong>${missions.filter(m => m.provider !== 'osrm').length} Connected Missions</strong></td>
    <td><strong style="color:var(--success); font-size:1.2rem;">${metrics.grossPayout.toFixed(2)} &euro;</strong></td>
    <td></td>
  `;
  tbody.appendChild(totalTr);
  desktopWrapper.appendChild(table);

  // Mobile Total Card
  const mobileTotal = document.createElement("div");
  mobileTotal.className = "mobile-total-card";
  mobileTotal.innerHTML = `
    <div>
      <div style="font-size:0.95rem;">TOTAL (${places.length - 1} Legs &middot; ${missions.filter(m => m.provider !== 'osrm').length} Missions)</div>
      <small style="color:var(--muted); font-weight:normal;">${metrics.drivingKm.toFixed(1)} km &middot; ${formatDuration(metrics.totalShiftMin)} shift</small>
    </div>
    <div style="font-size:1.35rem; color:var(--success); font-weight:700;">
      ${metrics.grossPayout.toFixed(2)} &euro;
    </div>
  `;
  mobileWrapper.appendChild(mobileTotal);

  els.results.appendChild(desktopWrapper);
  els.results.appendChild(mobileWrapper);

  // Render Protocols & Draw Map
  renderDriverProtocols(missions);
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

  places.forEach((p, idx) => {
    const isStart = idx === 0;
    const isEnd = idx === places.length - 1;
    const label = isStart ? `Start: ${p.city || p.name}` : (isEnd ? `Finish: ${p.city || p.name}` : `Stop ${idx}: ${p.city || p.name}`);

    const marker = L.marker([p.lat, p.lon]).addTo(group);
    marker.bindPopup(`<strong>${label}</strong><br/>${p.address || p.fullName || p.name}`);
    if (isStart || isEnd) marker.openPopup();
  });

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
  if (els.stops) els.stops.value = "Tarragona, Zaragoza, Valencia, Madrid";
  if (els.destination) els.destination.value = "Barcelona";
  if (els.totalDays) els.totalDays.value = "1";
}

function clearAll() {
  if (els.origin) els.origin.value = "Barcelona";
  if (els.destination) els.destination.value = "Barcelona";
  if (els.stops) els.stops.value = "";
  if (els.totalDays) els.totalDays.value = "1";
  ["prov_otoqui", "prov_driiveme", "prov_onlogist"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = true;
      el.closest(".platform-choice")?.classList.add("checked");
    }
  });
  if (els.results) els.results.innerHTML = "";
  if (els.summary) els.summary.innerHTML = "";
  if (els.driverInstructions) els.driverInstructions.innerHTML = "";
  if (routeLayer && map) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
}

// ==========================================================================
// Paste Missions Parser & Recent Searches
// ==========================================================================
function parseMissionsText(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const pairs = [];
  for (const line of lines) {
    let parts = line.split(/\s*(?:->|→|=>|;|\|)\s*/);
    if (parts.length < 2) {
      parts = line.split(/\s*,\s*/);
    }
    if (parts.length >= 2) {
      pairs.push([parts[0].trim(), parts[1].trim()]);
    }
  }
  if (!pairs.length) return null;
  const origin = pairs[0][0];
  const destination = pairs[pairs.length - 1][1];
  const seen = new Set([origin.toLowerCase(), destination.toLowerCase()]);
  const intermediate = [];
  for (const [a, b] of pairs) {
    for (const x of [a, b]) {
      const k = x.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        intermediate.push(x);
      }
    }
  }
  return { origin, destination, stops: intermediate.join(", ") };
}

function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem("recentSearches") || "[]");
  } catch (e) {
    return [];
  }
}

function saveRecentSearch(origin, destination, stops, totalDays, strategy) {
  if (!origin || !destination) return;
  const list = loadRecentSearches();
  const key = `${origin}|${destination}|${stops}`;
  const filtered = list.filter(x => `${x.origin}|${x.destination}|${x.stops}` !== key);
  filtered.unshift({ origin, destination, stops, totalDays, strategy, ts: Date.now() });
  const trimmed = filtered.slice(0, 10);
  localStorage.setItem("recentSearches", JSON.stringify(trimmed));
  renderRecentSearches();
}

function renderRecentSearches() {
  if (!els.recentSearches) return;
  const list = loadRecentSearches();
  els.recentSearches.innerHTML = `<option value="">-- select a recent search --</option>` +
    list.map((x, i) => `<option value="${i}">${x.origin} → ${x.destination}${x.stops ? " (" + x.stops + ")" : ""}</option>`).join("");
}

function applyRecentSearch(idx) {
  const list = loadRecentSearches();
  const x = list[idx];
  if (!x) return;
  if (els.origin) els.origin.value = x.origin;
  if (els.destination) els.destination.value = x.destination;
  if (els.stops) els.stops.value = x.stops || "";
  if (els.totalDays) els.totalDays.value = x.totalDays || 1;
  if (els.prefStrategy && x.strategy) els.prefStrategy.value = x.strategy;
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
  setupPlatformCheckboxes();
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

  if (els.parseMissionsBtn) {
    els.parseMissionsBtn.addEventListener("click", () => {
      const text = els.missionPaste ? els.missionPaste.value : "";
      const parsed = parseMissionsText(text);
      if (!parsed) {
        alert("Could not parse missions. Use one per line: Origin -> Destination");
        return;
      }
      if (els.origin) els.origin.value = parsed.origin;
      if (els.destination) els.destination.value = parsed.destination;
      if (els.stops) els.stops.value = parsed.stops;
    });
  }

  if (els.clearPasteBtn) {
    els.clearPasteBtn.addEventListener("click", () => {
      if (els.missionPaste) els.missionPaste.value = "";
    });
  }

  if (els.recentSearches) {
    els.recentSearches.addEventListener("change", () => {
      const idx = parseInt(els.recentSearches.value, 10);
      if (!isNaN(idx)) applyRecentSearch(idx);
    });
  }

  renderRecentSearches();

  search().catch(console.error);
});
