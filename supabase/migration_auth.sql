-- Migración para proyectos que ya tenían Casa Tareas funcionando con el
-- esquema anterior (acceso abierto con la clave "anon"). Ejecuta esto en el
-- SQL Editor de Supabase para: 1) añadir la columna de "día fijo" a las
-- tareas, y 2) exigir estar autenticado para leer/escribir.
--
-- Antes de ejecutar esto, crea las dos cuentas en Authentication > Users
-- (ver README) o el login dejará de funcionar hasta que las crees.

alter table tasks add column if not exists fixed_day text;

drop policy if exists "tasks_all" on tasks;
create policy "tasks_all" on tasks for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "occurrences_all" on occurrences;
create policy "occurrences_all" on occurrences for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "app_config_all" on app_config;
create policy "app_config_all" on app_config for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Opcional pero recomendado: marca "Cambiar sábanas" para que caiga en fin
-- de semana automáticamente (si ya tenías esa tarea creada antes de esta
-- actualización). No pasa nada si la tabla está vacía o no existe esa fila.
update tasks set fixed_day = 'weekend' where title = 'Cambiar sábanas' and room = 'Habitación';

-- Marca a Zaira y Jef con su identidad en auth.users (persona: zaira | jef)
-- una vez hayas creado sus cuentas desde Authentication > Users. Sustituye
-- los emails por los reales antes de ejecutar estas dos líneas. Usamos
-- coalesce(..., '{}'::jsonb) porque si raw_user_meta_data está a NULL,
-- "NULL || '{...}'::jsonb" da NULL en vez de añadir el campo (y de paso
-- borraría cualquier otro metadato que hubiera).
-- update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"person":"zaira"}'::jsonb where email = 'EMAIL_DE_ZAIRA';
-- update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"person":"jef"}'::jsonb where email = 'EMAIL_DE_JEF';
--
-- Después de ejecutarlo, comprueba que se ha guardado bien:
-- select email, raw_user_meta_data from auth.users where email in ('EMAIL_DE_ZAIRA', 'EMAIL_DE_JEF');
--
-- IMPORTANTE: si ya habíais iniciado sesión en la app antes de ejecutar
-- esto, tenéis que cerrar sesión y volver a entrar — los metadatos de la
-- persona conectada solo se leen al iniciar sesión, no se refrescan solos.
