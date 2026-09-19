# Tareario 🏠✨

App web adaptable (funciona bien en móvil y en PC) para repartir las tareas
del hogar entre dos personas (Zaira y Jef), marcarlas como hechas, cambiar de
responsable cuando haga falta, y ver estadísticas y gamificación (puntos,
rachas, insignias, penalizaciones) de cómo va cada uno.

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
  - Una tarea puede fijarse a un día concreto de la semana (o "fin de
    semana") desde **Ajustes** — útil para cosas como cambiar las sábanas,
    que siempre hacéis sábado o domingo (`fixedDay`).
  - Los minutos son una estimación mía razonable — corrígelos en **Ajustes**
    en cuanto tengáis una idea más real; el reparto futuro se recalcula solo
    con los valores nuevos.
- **Reparto automático** (`src/lib/schedule.ts`):
  - Decide primero en qué día cae cada tarea (respetando los días fijos).
  - Después asigna **por habitación y día completo**: si un día tocan varias
    tareas de la misma sala (p.ej. 4 tareas del salón, o la cocina diaria +
    la cocina semanal a fondo ese mismo día), todas van a la misma persona —
    no tiene sentido que uno limpie la mesa y otro el polvo.
  - El objetivo de equilibrio es **semanal, no diario**: cada semana (de
    lunes a domingo) se intenta que los minutos totales asignados a cada uno
    sean lo más parecidos posible, en vez de forzar que cada día concreto
    esté 50/50 (más difícil y menos realista).
  - El reparto futuro **se recalcula solo** en cuanto añades, editas o
    borras una tarea — ya no hace falta pulsar un botón (aunque sigue
    existiendo "Forzar regeneración ahora" en Ajustes por si acaso).
- **Gamificación** (`src/lib/gamification.ts`):
  - Puntos por tarea completada (más si la racha de días seguidos es larga,
    más si es fin de semana), penalización en puntos por tarea no marcada a
    tiempo, e insignias (🔥 racha, 🏅 semana perfecta, 👑 imparable, ✅ de
    fiar, 💎 sin fallos) — todo esto es **solo informativo/visual**.
  - Penalización que **sí afecta al reparto**: si una persona completa menos
    del 75% de sus tareas a tiempo durante una semana ("semana floja"), y
    esto se repite varias semanas seguidas, esa persona recibe algo **más**
    de carga (no menos) en la(s) semana(s) siguiente(s), hasta un máximo de
    62/38, y vuelve a 50/50 en cuanto recupera el ritmo. Se explica de forma
    transparente en **Stats** cuando está activo.
- **Login real** (Supabase Auth): cada persona tiene su propia cuenta
  (email + contraseña) en vez de simplemente "tocar quién eres" — necesario
  en cuanto configuráis Supabase, ver más abajo.
- **Compartido entre dispositivos**: los datos se guardan en Supabase (base
  de datos gratuita en la nube) para que tu pareja y tú veáis lo mismo desde
  el móvil y el PC. Si no configuras Supabase, la app funciona igual pero en
  "modo demo" guardando los datos solo en el dispositivo (localStorage), y
  sin pedir login (solo tiene sentido para probarla tú solo).

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
   crea las tablas `tasks`, `occurrences` y `app_config`, con las políticas
   de seguridad (RLS) que exigen estar autenticado para leer o escribir.
   - Si ya tenías un proyecto de una versión anterior (sin login), usa en su
     lugar [`supabase/migration_auth.sql`](supabase/migration_auth.sql): añade
     la columna que falta y actualiza las políticas para exigir login, sin
     borrar tus datos.
3. Ve a **Project Settings > API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL` (solo la URL base, sin `/rest/v1`
     al final, algo como `https://xxxxx.supabase.co`)
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
4. Copia `.env.example` como `.env.local` y pega esos dos valores.
5. Crea las dos cuentas (una por persona) en **Authentication > Users > Add
   user**, con el email y contraseña que vayáis a usar cada uno. Después,
   para cada usuario, edítalo y en **User Metadata** añade:
   ```json
   { "person": "zaira" }
   ```
   o `{ "person": "jef" }` según corresponda — esto es lo que le dice a la
   app "quién ha iniciado sesión". También hay plantillas SQL comentadas
   para hacer esto mismo dentro de `supabase/migration_auth.sql`.
6. Reinicia `npm run dev`. La primera vez que abras la app, el catálogo de
   tareas se sube automáticamente a Supabase, y verás la pantalla de login.

> Con Supabase configurado, la app **exige iniciar sesión** — nadie puede
> ver ni tocar el calendario sin una de las dos cuentas.

## 2. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub y sube este proyecto:
   ```bash
   git init
   git add .
   git commit -m "Primera versión de Tareario"
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
- **Stats**: puntos, racha actual, % de tareas completadas, insignias,
  minutos asignados esta semana a cada uno (y si el reparto está ajustado
  por una penalización, se explica ahí mismo), y la evolución de minutos
  completados de los últimos 14 días.
- **Ajustes**: aquí gestionáis el catálogo completo — **+ Nueva tarea** para
  añadir una tarea (sala, título, detalle, frecuencia, veces por periodo,
  cada cuántos meses si aplica, minutos, día fijo opcional), el lápiz ✏️
  para editar cualquier campo de una existente, y 🗑️ para borrarla (pide
  confirmación porque también borra su historial). También podéis
  pausar/activar tareas sin borrarlas y cerrar sesión.

## Estructura del proyecto

```
src/
  data/tasks.ts        catálogo de tareas (semilla inicial)
  lib/types.ts          tipos
  lib/schedule.ts        algoritmo de reparto/generación de ocurrencias
  lib/gamification.ts    puntos, rachas, insignias, objetivo semanal y penalización
  lib/store.ts            acceso a datos (Supabase o localStorage)
  context/               estado global (login, perfil activo, datos)
  components/             pantallas y piezas de UI
supabase/schema.sql        esquema SQL para Supabase (proyecto nuevo)
supabase/migration_auth.sql  migración para proyectos ya existentes (añade login)
.github/workflows/deploy.yml  despliegue automático a GitHub Pages
```
