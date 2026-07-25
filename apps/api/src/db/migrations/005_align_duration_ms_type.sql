-- Paired with the Postgres migration of the same name, which narrows
-- `duration_ms` from BIGINT to INTEGER.
--
-- SQLite already stores this column as INTEGER, so there is nothing to change
-- here. The file exists so both dialects apply the same numbered migrations
-- and a reader comparing the two directories does not have to work out whether
-- one was forgotten.
SELECT 1;
