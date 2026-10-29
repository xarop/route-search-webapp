# Agents

This repository contains two static web applications.

## Files
- `index.html`, `app.js`, `styles.css`: multi-leg route and vehicle transport mission finder using OSRM, OpenStreetMap, and integration with Otoqi, Driiveme, and Onlogist.
- `settings.html`: client-side configuration page for driver platform credentials, custom API endpoints, and navigation preferences.
- `help.html`: driver operational guide, platform handover checklists, and deep-link documentation.
- `i18n.js`: lightweight multi-language translation engine (Catalan, Spanish, English, French, Italian, German).
- `OptiRoute-BCN-Pro.html`: single-file driver app for vehicle transport missions in Barcelona.
- `README.md`, `DESIGN.md`, `humans.txt`.

## Guidelines
- Keep UI minimal and aligned with DESIGN.md (inspired by xarop.com).
- Mobile-first, responsive, generous whitespace, subtle borders, no heavy shadows.
- Do not expose real credentials; use browser `localStorage` for API keys and tokens.
- Prefer vanilla JS, no build step.
- All default user-facing text is English, with multilingual switching (CA/ES/EN/FR/IT/DE) via `i18n.js`.
- Sign as "Developed in Barcelona by xarop.com".

## Developed in Barcelona by xarop.com
https://xarop.com
