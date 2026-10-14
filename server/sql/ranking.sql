-- Tabla del ranking semanal de Hordalia. Ejecútalo una vez en Supabase → SQL Editor.
-- Una fila por semana (por ejemplo "2026-W42"); "data" guarda todas las monedas de esa semana.
create table if not exists public.ranking (
  week text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Solo el servidor (con la clave service_role) puede leer y escribir.
-- Sin políticas, la clave pública (anon) no tiene acceso.
alter table public.ranking enable row level security;
