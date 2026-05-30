-- ─────────────────────────────────────────────────────────────────────────────
-- Pontos georeferenciados (fotos plotadas no mapa de campo)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists lider_pontos (
  id           uuid primary key default gen_random_uuid(),
  mapa_id      uuid references lider_mapas(id) on delete cascade,
  workspace_id uuid not null,
  criado_por   uuid references auth.users(id) on delete set null,
  lat          double precision not null,
  lng          double precision not null,
  foto_url     text,
  descricao    text,
  criado_em    timestamptz default now()
);

-- Índices para lookup rápido por mapa
create index if not exists lider_pontos_mapa_id_idx on lider_pontos(mapa_id);
create index if not exists lider_pontos_ws_idx      on lider_pontos(workspace_id);

-- Row Level Security
alter table lider_pontos enable row level security;

create policy "workspace_members_pontos"
  on lider_pontos for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
       where user_id = auth.uid()
    )
  );
