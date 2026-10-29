# OptiRoute / Real Route Finder

Project with two applications:

1. `index.html` + `app.js` + `styles.css`: multi-leg route finder between cities using real road distances/times (OSRM + OpenStreetMap), with platforms Otoqui, Driiveme and Onlogist.
2. `OptiRoute-BCN-Pro.html`: single-file app for vehicle transport drivers in Barcelona (missions, net profit, trip chaining, checklist and extensible providers).

## Run locally
From the project folder:

```bash
cd "/Users/xarop/Local Sites/route-search-webapp"
python3 -m http.server 8000
```

Then open in your browser:
- http://localhost:8000/
- http://localhost:8000/OptiRoute-BCN-Pro.html

## Notes
- Platforms are B2B; prices in `OptiRoute-BCN-Pro.html` are editable estimates.
- Providers can be added/removed from the "Providers" tab.

## Publish to GitHub Pages
1. Go to repository Settings → Pages.
2. Source: Deploy from a branch.
3. Branch: `main`, folder: `/ (root)`.
4. Save. The site will be available at `https://xarop.github.io/route-search-webapp/`.

Developed in Barcelona by [xarop.com](https://xarop.com)