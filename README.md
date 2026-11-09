# Kernel Ideas

Ideas clave de libros, artículos, podcasts y videos, destiladas en tarjetas que se leen en un par de minutos.
Flask + PostgreSQL, se instala en el celular como app (PWA).

## Qué incluye

- **Feed de tarjetas**: resumen, puntos clave, una acción para "Try today" y la fuente citada. Se navega deslizando la tarjeta.
- **Biblioteca**: 38 fuentes (libros, artículos, podcasts y videos) con 118 ideas, cada una con su portada generada.
- **Boards**: colecciones propias para guardar y organizar ideas.
- **Progreso**: meta diaria, racha, calendario de 4 semanas y avance por tema.
- **Ideas propias**: agrega lo que aprendas de cualquier fuente.

## Deploy: GitHub → Railway

1. Crea un repo en GitHub (por ejemplo `kernel-ideas`) y sube esta carpeta:
   ```bash
   git init && git add . && git commit -m "Kernel Ideas"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/kernel-ideas.git
   git push -u origin main
   ```
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repo.
3. En el mismo proyecto: **+ New → Database → PostgreSQL**.
4. En el servicio web, abre **Variables** y agrega:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia a la base de datos)
   - `SECRET_KEY` = una cadena larga y aleatoria
   - `APP_PASSWORD` = tu contraseña para entrar
5. En **Settings → Networking**, genera un dominio. Opcional: usa un dominio propio.

Cada `git push` vuelve a desplegar la app automáticamente.

## Instalarla en el celular

- **iPhone (Safari)**: abre tu dominio, inicia sesión y toca Compartir → Agregar a pantalla de inicio.
- **Android (Chrome)**: menú ⋮ → Instalar app.

## Agregar contenido

Edita `content.py`, agrega una fuente con `S(...)` y sus ideas con `I(...)`, y haz push.
La app sincroniza el contenido al arrancar sin borrar tu progreso.

### Portadas

Cada fuente tiene una portada original dibujada en SVG en `static/covers.js` (sin imágenes externas).
Para darle portada propia a una fuente nueva, agrega una entrada en `MOTIFS` con el slug de su título
(minúsculas, lo que no sea letra o número pasa a `-`; por ejemplo `"Deep Work"` → `deep-work`).
Las fuentes sin entrada usan una portada genérica según su formato (libro, artículo, video o podcast).

## Correr en local

```bash
pip install -r requirements.txt
APP_PASSWORD=test python app.py
# abre http://localhost:5000
```
Sin `DATABASE_URL`, la app usa SQLite local.
