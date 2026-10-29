const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const providerPricing = {
  otoqui: { label: "Otoqui", base: 15, perKm: 0.15, perDay: 0 },
  driiveme: { label: "Driiveme", base: 1, perKm: 0.08, perDay: 0 },
  onlogist: { label: "Onlogist", base: 20, perKm: 0.12, perDay: 0 },
};
const els = {
  origin: document.getElementById("origin"),
  destination: document.getElementById("destination"),
  totalDays: document.getElementById("totalDays"),
  stops: document.getElementById("stops"),
  providers: document.getElementById("providers"),
  searchBtn: document.getElementById("searchBtn"),
  exampleBtn: document.getElementById("exampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  summary: document.getElementById("summary"),
  results: document.getElementById("results"),
};
let map = null;
let routeLayer = null;
function initMap() {
  map = L.map("map").setView([41.3851, 2.1734], 6);
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  L.tileLayer(tileUrl, { attribution: "OSM" }).addTo(map);
}
async function geocode(place) {
  const url = NOMINATIM + "?format=json&limit=1&q=" + encodeURIComponent(place);
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  if (!res.ok) throw new Error("Geocoding failed: " + place);
  const data = await res.json();
  if (!data.length) throw new Error("No se encontro la ubicacion: " + place);
  return { name: place, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}
async function routeBetween(a, b) {
  const url = OSRM + "/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=full&geometries=geojson";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing failed");
  const data = await res.json();
  if (!data.routes || !data.routes.length) throw new Error("Sin ruta entre " + a.name + " y " + b.name);
  const r = data.routes[0];
  return { distanceKm: r.distance / 1000, durationMin: r.duration / 60, geometry: r.geometry };
}
function selectedProviders() {
  return [...els.providers.selectedOptions].map((o) => o.value);
}
function buildStopsList() {
  const origin = els.origin.value.trim();
  const stopsRaw = els.stops.value.trim();
  const destination = els.destination.value.trim();
  const stops = [origin];
  if (stopsRaw) {
    stops.push(...stopsRaw.split(",").map((s) => s.trim()).filter(Boolean));
  }
  if (destination && destination.toLowerCase() !== origin.toLowerCase()) {
    stops.push(destination);
  } else if (stops.length > 1 && stops[0].toLowerCase() === destination.toLowerCase()) {
    if (stops[stops.length - 1].toLowerCase() !== origin.toLowerCase()) stops.push(origin);
  }
  if (stops.length === 1) stops.push(stops[0]);
  return stops;
}
function mockOffers(provider, origin, destination, distanceKm, durationMin, days) {
  const p = providerPricing[provider];
  const price = p.base + distanceKm * p.perKm + days * p.perDay;
  return [{
    provider,
    label: p.label,
    origin: origin.name,
    destination: destination.name,
    distanceKm,
    durationMin,
    price: Number(price.toFixed(2)),
    currency: "EUR",
    days,
    url: platformUrl(provider),
  }];
}
function platformUrl(provider) {
  switch (provider) {
    case "otoqui": return "https://en.otoqi.com/";
    case "driiveme": return "https://www.driiveme.com/";
    case "onlogist": return "https://www.onlogist.com/";
    default: return "#";
  }
}
async function search() {
  els.summary.textContent = "Buscando rutas reales por carretera...";
  els.results.innerHTML = "";
  const providers = selectedProviders();
  if (!providers.length) {
    els.summary.textContent = "Selecciona al menos una plataforma.";
    return;
  }
  const stopNames = buildStopsList();
  let places;
  try {
    places = await Promise.all(stopNames.map(geocode));
  } catch (e) {
    els.summary.textContent = "Error de geocodificacion: " + e.message;
    return;
  }
  const legs = [];
  for (let i = 0; i < places.length - 1; i++) {
    try {
      const r = await routeBetween(places[i], places[i + 1]);
      legs.push({ from: places[i], to: places[i + 1], ...r });
    } catch (e) {
      els.summary.textContent = "Error de routing: " + e.message;
      return;
    }
  }
  const totalDays = Math.max(1, parseInt(els.totalDays.value, 10) || 1);
  const perLegDays = Math.max(1, Math.round(totalDays / Math.max(1, legs.length)));
  const allOffers = [];
  for (const leg of legs) {
    for (const prov of providers) {
      allOffers.push(...mockOffers(prov, leg.from, leg.to, leg.distanceKm, leg.durationMin, perLegDays));
    }
  }
  const totalKm = legs.reduce((s, l) => s + l.distanceKm, 0);
  const totalMin = legs.reduce((s, l) => s + l.durationMin, 0);
  const totalPrice = allOffers.reduce((s, o) => s + o.price, 0);
  els.summary.innerHTML =
    "<strong>Ruta:</strong> " + places.map((p) => p.name).join(" -> ") + "<br/>" +
    "<strong>Viajes:</strong> " + legs.length + " &middot; <strong>Distancia total:</strong> " + totalKm.toFixed(1) + " km &middot; " +
    "<strong>Tiempo estimado:</strong> " + formatDuration(totalMin) + " &middot; " +
    "<strong>Coste total estimado:</strong> " + totalPrice.toFixed(2) + " EUR (" + allOffers.length + " ofertas)";
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>Plataforma</th><th>Origen</th><th>Destino</th><th>km</th><th>Tiempo</th><th>Dias</th><th>Precio (EUR)</th><th>Enlace</th></tr></thead><tbody></tbody>";
  const tbody = table.querySelector("tbody");
  for (const o of allOffers) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td><span class=\"badge\">" + o.label + "</span></td>" +
      "<td>" + o.origin + "</td>" +
      "<td>" + o.destination + "</td>" +
      "<td>" + o.distanceKm.toFixed(1) + "</td>" +
      "<td>" + formatDuration(o.durationMin) + "</td>" +
      "<td>" + o.days + "</td>" +
      "<td>" + o.price.toFixed(2) + "</td>" +
      "<td><a href=\"" + o.url + "\" target=\"_blank\" rel=\"noopener\">Abrir</a></td>";
    tbody.appendChild(tr);
  }
  const tr = document.createElement("tr");
  tr.innerHTML = "<td colspan=\"3\"><strong>TOTAL</strong></td><td><strong>" + totalKm.toFixed(1) + "</strong></td><td><strong>" + formatDuration(totalMin) + "</strong></td><td><strong>" + totalDays + "</strong></td><td><strong>" + totalPrice.toFixed(2) + "</strong></td><td></td>";
  tbody.appendChild(tr);
  els.results.appendChild(table);
  drawRoute(places, legs);
}
function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return m + " min";
  return h + " h " + m + " min";
}
function drawRoute(places, legs) {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }
  const group = L.featureGroup();
  places.forEach((p) => L.marker([p.lat, p.lon]).addTo(group).bindPopup(p.name));
  legs.forEach((leg) => {
    if (leg.geometry && leg.geometry.coordinates) {
      const coords = leg.geometry.coordinates.map((c) => [c[1], c[0]]);
      L.polyline(coords, { color: "#2563eb", weight: 4 }).addTo(group);
    } else {
      L.polyline([[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]], { color: "#2563eb", weight: 4 }).addTo(group);
    }
  });
  routeLayer = group.addTo(map);
  map.fitBounds(group.getBounds().pad(0.1));
}
function loadExample() {
  els.origin.value = "Barcelona";
  els.stops.value = "Zaragoza, Madrid, Valencia, Tarragona";
  els.destination.value = "Barcelona";
  els.totalDays.value = "5";
}
function clearAll() {
  els.origin.value = "Barcelona";
  els.destination.value = "Barcelona";
  els.totalDays.value = "1";
  els.stops.value = "";
  els.results.innerHTML = "";
  els.summary.textContent = "";
}
els.searchBtn.addEventListener("click", () => search().catch((e) => { els.summary.textContent = "Error: " + e.message; }));
els.exampleBtn.addEventListener("click", loadExample);
els.clearBtn.addEventListener("click", clearAll);
initMap();
loadExample();
search().catch((e) => { els.summary.textContent = "Error: " + e.message; });
