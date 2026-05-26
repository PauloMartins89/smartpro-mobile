-- Tabela: lider_controle_epi
-- Registra a entrega, validade e situação de EPIs por colaborador durante o turno.

CREATE TABLE IF NOT EXISTS lider_controle_epi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id        UUID NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL,
  colaborador_id  UUID REFERENCES lider_colaboradores(id),
  epi_id          UUID REFERENCES lider_catalogo_epi(id),
  motivo          TEXT,           -- 'Primeiro fornecimento','Reposicao','Substituicao por dano','EPI vencido'
  validade        DATE,           -- data de validade do EPI entregue
  status          TEXT NOT NULL DEFAULT 'entregue'
                  CHECK (status IN ('entregue','pendente','vencendo','vencido')),
  foto_url        TEXT,
  observacao      TEXT,
  criado_por      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_lider_controle_epi_turno    ON lider_controle_epi(turno_id);
CREATE INDEX IF NOT EXISTS idx_lider_controle_epi_colabws  ON lider_controle_epi(workspace_id, colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lider_controle_epi_status   ON lider_controle_epi(status);

-- RLS
ALTER TABLE lider_controle_epi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lider_controle_epi_workspace" ON lider_controle_epi
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM lider_equipes
      WHERE id IN (
        SELECT equipe_id FROM lider_lider_equipes WHERE lider_id = auth.uid()
      )
    )
  );

-- Trigger updated_at
CREATE OR REPLACE TRIGGER lider_controle_epi_updated_at
  BEFORE UPDATE ON lider_controle_epi
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
