-- Segunda Parte · esquema de base de datos
-- Pegar entero en el SQL Editor de Supabase y ejecutar. Es idempotente:
-- se puede volver a lanzar sin romper nada.

-- ---------------------------------------------------------------- tablas

-- Una fila por usuario. De momento solo marca desde cuando entrenas;
-- el XP y los niveles se calculan a partir de las series, no se guardan,
-- asi no pueden desincronizarse.
create table if not exists public.perfil (
  id      uuid primary key references auth.users on delete cascade,
  creado  timestamptz not null default now()
);

-- Un entreno concreto: una fecha y un dia del plan.
create table if not exists public.sesion (
  id           uuid primary key default gen_random_uuid(),
  usuario      uuid not null references auth.users on delete cascade,
  fecha        date not null,
  dia          text not null check (dia in ('d1','d2')),
  modo         text not null check (modo in ('conPartido','sinPartido')),
  series_plan  integer not null default 0,
  completada   boolean not null default false,
  creada       timestamptz not null default now(),
  unique (usuario, fecha, dia)
);

-- Una fila por serie marcada. e1rm es el 1RM estimado (formula de Epley):
-- lo calcula Postgres, asi el cliente no puede meter un valor incoherente.
create table if not exists public.serie (
  id         uuid primary key default gen_random_uuid(),
  usuario    uuid not null references auth.users on delete cascade,
  sesion     uuid not null references public.sesion on delete cascade,
  ejercicio  text not null,
  slot       integer not null default 0,
  n_serie    integer not null,
  variante   text,
  peso       numeric(6,2),
  reps       integer,
  e1rm       numeric(7,2) generated always as (
               case when peso is not null and reps is not null and reps > 0
                    then round(peso * (1 + reps / 30.0), 2) end
             ) stored,
  hecha_en   timestamptz not null default now(),
  unique (sesion, ejercicio, slot, n_serie)
);

-- Logros desbloqueados. La fecha es la de desbloqueo, no se reescribe.
create table if not exists public.logro (
  usuario  uuid not null references auth.users on delete cascade,
  clave    text not null,
  fecha    timestamptz not null default now(),
  primary key (usuario, clave)
);

create index if not exists sesion_usuario_fecha_idx on public.sesion (usuario, fecha desc);
create index if not exists serie_usuario_ejercicio_idx on public.serie (usuario, ejercicio);
create index if not exists serie_sesion_idx on public.serie (sesion);

-- ------------------------------------------------------------------ RLS
-- Cada usuario solo ve y escribe lo suyo. Sin esto, la clave anon publica
-- de la web dejaria los datos al aire.

alter table public.perfil enable row level security;
alter table public.sesion enable row level security;
alter table public.serie  enable row level security;
alter table public.logro  enable row level security;

drop policy if exists "perfil propio"    on public.perfil;
drop policy if exists "sesiones propias" on public.sesion;
drop policy if exists "series propias"   on public.serie;
drop policy if exists "logros propios"   on public.logro;

create policy "perfil propio" on public.perfil
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "sesiones propias" on public.sesion
  for all using (auth.uid() = usuario) with check (auth.uid() = usuario);
create policy "series propias" on public.serie
  for all using (auth.uid() = usuario) with check (auth.uid() = usuario);
create policy "logros propios" on public.logro
  for all using (auth.uid() = usuario) with check (auth.uid() = usuario);

-- --------------------------------------------------------------- perfil
-- Crear el perfil solo al registrarse, sin depender de que el cliente
-- se acuerde de hacerlo.

create or replace function public.nuevo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.nuevo_perfil();

-- --------------------------------------------------------------- vistas
-- No las necesita la app (calcula todo en el cliente para funcionar sin
-- cobertura), pero van bien para mirar los datos desde el panel.
-- security_invoker: la vista respeta el RLS de quien consulta.

-- Tu mejor marca actual por ejercicio.
create or replace view public.pr with (security_invoker = true) as
select distinct on (usuario, ejercicio)
       usuario, ejercicio, peso, reps, e1rm, hecha_en
from public.serie
where e1rm is not null
order by usuario, ejercicio, e1rm desc, hecha_en asc;

-- Cada serie que en su momento batio todo lo anterior de ese ejercicio.
create or replace view public.pr_historico with (security_invoker = true) as
select id, usuario, ejercicio, peso, reps, e1rm, hecha_en
from (
  select s.*,
         max(e1rm) over (partition by usuario, ejercicio order by hecha_en
                         rows between unbounded preceding and 1 preceding) as previo
  from public.serie s
  where e1rm is not null
) t
where previo is null or e1rm > previo;
