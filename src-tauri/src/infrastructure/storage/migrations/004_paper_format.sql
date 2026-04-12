-- Adiciona formato de papel capturado do spooler (ex: "A4", "A3", "Carta").
-- NULL quando o driver/CUPS não fornece a informação.
ALTER TABLE jobs ADD COLUMN paper_format TEXT;

CREATE INDEX idx_jobs_paper_format ON jobs(paper_format);
