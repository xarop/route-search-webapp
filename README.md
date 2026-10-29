# OptiRoute / Real Route Finder

Professional multi-platform vehicle transport & route planner for jockey drivers in Spain and Europe. Combines live road routing (**OSRM / OpenStreetMap**) with vehicle delivery missions from **Otoqi**, **Driiveme**, and **Onlogist**.

Developed in Barcelona by [xarop.com](https://xarop.com).

---

## ✨ Features

- **Multi-Platform Mission Chaining**: Find and chain outbound and return trips across multiple platforms (e.g. Barcelona &rarr; Tarragona with Otoqi, Tarragona &rarr; Zaragoza with Driiveme, and Zaragoza &rarr; Barcelona with Onlogist) to maximize driver earnings and avoid empty returns.
- **Real Road Calculations**: Uses OpenStreetMap road networks via OSRM to calculate real road distance in kilometers, driving duration, and full turn-by-turn geometry.
- **Multi-Language Frontend (i18n)**: Instant switching between **Catalan (CA)**, **Spanish (ES)**, **English (EN)**, **French (FR)**, **Italian (IT)**, and **German (DE)** without page reloads.
- **Modern, Mobile-First UI (xarop.com style)**: Clean, generous whitespace, subtle borders, flat surfaces, responsive cards, and dark/light mode toggle with simple SVG icons.
- **Driver Platform Credentials (`settings.html`)**: Direct browser configuration for Otoqi, Driiveme, and Onlogist API keys and tokens, with guidance links to driver partner portals.
- **Navigation & Mobile App Launchers**:
  - One-tap links for **Google Maps Navigation** (`https://www.google.com/maps/dir/...`).
  - One-tap links for **Waze Navigation** (`https://waze.com/ul?...`).
  - Direct links to open the native **Otoqi**, **Driiveme**, and **Onlogist** driver apps or web portals.
- **Operational Handover Protocols**: Displays step-by-step handover instructions (photo checklist, odometer/battery % check, electronic CMR document) customized to the platforms used in the itinerary.
- **100% Client-Side & Static**: No build steps, no backend servers, zero credential tracking. Perfectly suited for **GitHub Pages**.

---

## 🚀 Live Demo & GitHub Pages Deployment

To host this repository on GitHub Pages:

1. Push this repository to GitHub on branch `main`:
   ```bash
   git add .
   git commit -m "Refactor route search webapp: modern mobile-first UI, i18n, platform integration"
   git push origin main
   ```
2. In your GitHub repository, navigate to **Settings &rarr; Pages**.
3. Under **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Click **Save**. Within 1–2 minutes, your web application will be live at:
   ```
   https://<your-username>.github.io/route-search-webapp/
   ```

---

## 🛠️ Local Development

Run any static HTTP server from the project directory:

```bash
cd route-search-webapp
python3 -m http.server 8000
```

Then open in your browser:
- `http://localhost:8000/` (Main Route & Mission Finder)
- `http://localhost:8000/settings.html` (Driver Credentials & Settings)
- `http://localhost:8000/help.html` (Operational Guide & Checklists)
- `http://localhost:8000/OptiRoute-BCN-Pro.html` (Single-file BCN Driver Tool)

---

## 🔑 Driver Credentials Configuration

Open the **Settings** page (`settings.html`) to configure:

1. **Otoqi**: Partner API Key / Driver Token (obtained from the [Otoqi Driver Portal](https://en.otoqi.com/)).
2. **Driiveme**: Pro Jockey Bearer Token (obtained from the [Driiveme Pro Dashboard](https://www.driiveme.com/pro/)).
3. **Onlogist**: Partner API Key (obtained from the [Onlogist Partner Portal](https://www.onlogist.com/)).
4. **OSRM Base URL**: Defaults to `https://router.project-osrm.org` (free public OpenStreetMap router) or your own self-hosted OSRM server.
5. **Google Maps API Key**: Optional; if provided, enables Google Directions API integration.

*Note: All credentials are encrypted in your browser's `localStorage` and never leave your device.*

---

## 📄 License & Attribution

- Built with [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/).
- Geocoding powered by [Photon Komoot](https://photon.komoot.io/).
- Road routing powered by [OSRM](https://project-osrm.org/).
- Developed in Barcelona by [xarop.com](https://xarop.com).
