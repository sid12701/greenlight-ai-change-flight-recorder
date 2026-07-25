-- `duration_ms` was added as INTEGER for SQLite and BIGINT for Postgres.
--
-- node-postgres returns int8 as a string to avoid losing precision above
-- 2^53, so the receipt carried "123000" where its own contract declares
-- `number | null`. The web client validates against that contract, so the
-- entire receipt page failed to render on Postgres while passing on SQLite —
-- which is why a round-trip test on SQLite did not catch it.
--
-- Aligning the column with the SQLite schema removes the divergence rather
-- than coercing the symptom. A CI duration in milliseconds cannot approach the
-- INTEGER ceiling: it is over 24 days.
ALTER TABLE pipeline_runs
  ALTER COLUMN duration_ms TYPE INTEGER;
