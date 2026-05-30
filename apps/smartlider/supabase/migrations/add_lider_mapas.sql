-- ════════════════════════════════════════════════════════════════════════════
-- Mapas georeferenciados (lider_mapas)
-- Gerados a partir de GeoPDFs do ArcGIS/Avenza.
-- Armazena o PNG do mapa + bounding box extraído do VP/Measure/GPTS.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lider_mapas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL,
  nome            text NOT NULL,
  descricao       text,
  tipo            text NOT NULL DEFAULT 'microplanejamento'
                  CHECK (tipo IN ('acesso', 'microplanejamento', 'outro')),
  imagem_url      text NOT NULL,       -- URL pública no Supabase Storage
  tamanho_bytes   integer,             -- tamanho do arquivo PNG para exibir no app
  -- Bounding box em WGS84 (graus decimais)
  sw_lat          double precision NOT NULL,
  sw_lng          double precision NOT NULL,
  ne_lat          double precision NOT NULL,
  ne_lng          double precision NOT NULL,
  -- Metadados opcionais do PDF origem
  pdf_origem      text,                -- nome do arquivo PDF original
  pdf_escala      text,                -- ex: "1:5000"
  pdf_datum       text,                -- ex: "SIRGAS 2000"
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lider_mapas_workspace
  ON lider_mapas (workspace_id, ativo);

-- RLS
ALTER TABLE lider_mapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members lider_mapas" ON lider_mapas;
CREATE POLICY "workspace members lider_mapas" ON lider_mapas
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
