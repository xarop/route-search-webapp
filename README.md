# Buscador de Rutas Reales (Otoqui / Driiveme / Onlogist)

Webapp para buscar y combinar rutas con varios viajes entre ciudades, usando distancias y tiempos reales por carretera (OSRM + OpenStreetMap).

## Caracteristicas
- Origen y destino por defecto: Barcelona.
- Dias totales por defecto: 1.
- Rutas con varias paradas (ej. Barcelona -> Zaragoza -> Madrid -> Valencia -> Tarragona -> Barcelona).
- Seleccion de plataformas: Otoqui, Driiveme, Onlogist.
- Calculo de km totales, tiempo estimado, costes por plataforma e importe total.

## Uso
Abrir `index.html` en el navegador (o servir con un servidor estatico).

## Nota sobre APIs reales
Las plataformas Otoqui, Driiveme y Onlogist son B2B y requieren credenciales/API keys. Los adaptadores actuales generan estimaciones de precio basadas en distancia. Sustituye `mockOffers` por llamadas reales cuando tengas acceso.

## GitHub
Este proyecto se ha inicializado como repositorio git local. Para subirlo a GitHub:
1. Crea un repositorio vacio en GitHub (ej. `route-search-webapp`).
2. `git remote add origin git@github.com:TU_USUARIO/route-search-webapp.git`
3. `git push -u origin main` (o `master` segun rama).