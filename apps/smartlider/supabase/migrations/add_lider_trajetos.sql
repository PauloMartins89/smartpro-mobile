-- Trajetos gravados pelo líder no mapa GPS
create table if not exists lider_trajetos (
  id           uuid primary key default gen_random_uuid(),
  mapa_id      uuid references lider_mapas(id) on delete cascade,
  workspace_id uuid not null,
  criado_por   uuid references auth.users(id) on delete set null,
  tipo         text not null default 'linha' check (tipo in ('linha', 'poligonal')),
  pontos       jsonb not null,        -- [{lat, lng, ts}]
  perimetro_m  integer,               -- metros lineares (distância total)
  area_m2      integer,               -- metros quadrados (null para tipo='linha')
  duracao_s    integer,
  criado_em    timestamptz default now(),

  -- Colunas geradas/calculadas para facilitar queries
  area_ha      double precision generated always as (area_m2::double precision / 10000) stored
);

-- Índices
create index if not exists lider_trajetos_mapa_idx      on lider_trajetos(mapa_id);
create index if not exists lider_trajetos_workspace_idx on lider_trajetos(workspace_id);

-- RLS
alter table lider_trajetos enable row level security;

create policy "workspace_members_trajetos"
  on lider_trajetos for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = auth.uid()
    )
  );
