# Casa Tareas 🏠✨

App web adaptable (funciona bien en móvil y en PC) para repartir las tareas
del hogar entre dos personas (Zaira y Jef), marcarlas como hechas, cambiar de
responsable cuando haga falta, y ver estadísticas y gamificación (puntos,
rachas, insignias) de cómo va cada uno.

- En **móvil**: navegación por pestañas abajo, pensada para marcar tareas
  como hechas rápido durante el día.
- En **pantallas grandes (PC/tablet)**: menú lateral fijo y listas en varias
  columnas, pensado para gestionar el catálogo (añadir, editar, pausar o
  borrar tareas) cómodamente desde **Ajustes**.

## Cómo está pensada

- **Catálogo de tareas** (`src/data/tasks.ts`): todas las tareas de
  `lista de tareas.txt`, con una duración estimada en minutos, su frecuencia
  (diaria/semanal/mensual) y cuántas veces se repite en el periodo.
  - `F2` / `F3` en el listado original = la tarea se repite 2 o 3 veces
    dentro de esa semana/mes (`timesPerPeriod`).
  - `/2`, `/3`, `/6` en tareas mensuales = se hace cada 2, 3 o 6 meses, no
    todos los meses (`intervalMonths`).
  - Los minutos son una estimación mía razonable — corrígelos en **Ajustes**
    en cuanto tengáis una idea más real; el reparto futuro se recalcula con
    los valores nuevos.
- **Reparto automático** (`src/lib/schedule.ts`): genera cada tarea en una
  fecha concreta, repartiendo el trabajo semanal/mensual entre entre semana
  cuando es posible (para no cargar el fin de semana) y asignando cada tarea
  a quien lleve menos minutos acumulados, para que quede equilibrado entre
  los dos. Las tareas diarias suman ~57 min/día combinados entre ambos, muy
  cerca del objetivo de 1h/día que pediste.
- **Gamificación** (`src/lib/gamification.ts`): puntos por tarea completada
  (más si la racha de días seguidos es larga, más si es fin de semana),
  penalización por tarea no marcada a tiempo, insignias por constancia.
- **Compartido entre dispositivos**: los datos se guardan en Supabase (base
  de datos gratuita en la nube) para que tu pareja y tú veáis lo mismo desde
  el móvil y el PC. Si no configuras Supabase, la app funciona igual pero en
  "modo demo" guardando los datos solo en el dispositivo (localStorage).

## Puesta en marcha local

```bash
npm install
npm run dev
```

Abre la URL que te indique (normalmente http://localhost:5173).

## 1. Configurar Supabase (para compartir el calendario entre los dos)

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y un
   proyecto nuevo (elige la región más cercana, p.ej. Frankfurt).
2. En el proyecto, ve a **SQL Editor > New query**, pega el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo (▶ Run). Esto
   crea las tablas `tasks`, `occurrences` y `app_config`.
3. Ve a **Project Settings > API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
4. Copia `.env.example` como `.env.local` y pega esos dos valores.
5. Reinicia `npm run dev`. La primera vez que abras la app, el catálogo de
   tareas se sube automáticamente a Supabase.

> ⚠️ **Nota de seguridad**: para mantenerlo simple no hay login — cualquiera
> con el enlace de la app y esta clave "anon" podría leer/escribir el
> calendario. Es aceptable para un uso privado entre dos personas de
> confianza, pero no compartas el enlace públicamente. Si más adelante
> queréis login, Supabase Auth se puede añadir sin cambiar el resto.

## 2. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube este proyecto:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de Casa Tareas"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```
2. En el repositorio de GitHub, ve a **Settings > Pages** y en "Build and
   deployment" elige **Source: GitHub Actions**.
3. Ve a **Settings > Secrets and variables > Actions > New repository
   secret** y añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (los mismos valores de tu `.env.local`).
4. Cada `push` a `main` ejecuta [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
   que compila la app y la publica. La URL final aparece en **Settings >
   Pages** (algo como `https://<tu-usuario>.github.io/<tu-repo>/`).
5. Desde el móvil, abre esa URL en Chrome/Safari y usa "Añadir a pantalla de
   inicio" — la app tiene manifest PWA, así que se comporta como una app
   normal (icono propio, pantalla completa).

Si prefieres Netlify o Vercel en vez de GitHub Pages, también funciona:
conecta el repo, comando de build `npm run build`, carpeta `dist`, y añade
las mismas dos variables de entorno en su panel.

## Uso del día a día

- **Hoy**: tus tareas de hoy con check ✅, y las de tu pareja para que veáis
  la carga de ambos. El botón 🔁 cambia el responsable de una tarea concreta
  (útil si os intercambiáis un turno).
- **Semana**: calendario semanal desplegable, día a día, con el reparto de
  minutos de cada uno.
- **Stats**: puntos, racha actual, % de tareas completadas, insignias, y la
  evolución de minutos completados de los últimos 14 días.
- **Ajustes**: aquí gestionáis el catálogo completo — **+ Nueva tarea** para
  añadir una tarea (sala, título, detalle, frecuencia, veces por periodo,
  cada cuántos meses si aplica, minutos), el lápiz ✏️ para editar cualquier
  campo de una existente, y 🗑️ para borrarla (pide confirmación porque
  también borra su historial). También podéis pausar/activar tareas sin
  borrarlas, cambiar el perfil de este dispositivo, y "Regenerar reparto
  futuro" si cambiáis algo y queréis que se recalculen los próximos días
  (nunca toca lo ya hecho). Pensado para usarse cómodamente desde el PC.

## Estructura del proyecto

```
src/
  data/tasks.ts        catálogo de tareas (semilla inicial)
  lib/types.ts          tipos
  lib/schedule.ts        algoritmo de reparto/generación de ocurrencias
  lib/gamification.ts    puntos, rachas, insignias
  lib/store.ts            acceso a datos (Supabase o localStorage)
  context/               estado global (perfil activo, datos)
  components/             pantallas y piezas de UI
supabase/schema.sql        esquema SQL para Supabase
.github/workflows/deploy.yml  despliegue automático a GitHub Pages
```
