ALTER TABLE pipeline_runs ADD COLUMN duration_ms BIGINT;
ALTER TABLE pipeline_runs ADD COLUMN slowest_step TEXT;
