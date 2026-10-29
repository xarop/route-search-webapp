# OptiRoute / Buscador de Rutas Reales

Proyecto con dos aplicaciones:

1. `index.html` + `app.js` + `styles.css`: buscador de rutas multi-tramo entre ciudades usando distancias/tiempos reales (OSRM + OpenStreetMap), con plataformas Otoqui, Driiveme y Onlogist.
2. `OptiRoute-BCN-Pro.html`: aplicación de un solo archivo para transportistas de vehículos en Barcelona (misiones, beneficio neto, encadenado de viajes, checklist y proveedores extensibles).

## Ejecutar en local
Desde la carpeta del proyecto:

```bash
cd "/Users/xarop/Local Sites/route-search-webapp"
python3 -m http.server 8000
```

Luego abre en el navegador:
- http://localhost:8000/
- http://localhost:8000/OptiRoute-BCN-Pro.html

## Notas
- Las plataformas son B2B; los precios de `OptiRoute-BCN-Pro.html` son estimaciones editables.
- Los proveedores se pueden añadir/eliminar desde la pestaña "Proveedores".