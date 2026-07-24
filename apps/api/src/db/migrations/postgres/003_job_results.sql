-- PostgreSQL translation of 003_job_results.sql.
-- Kept as a separate file because DDL, unlike DML, genuinely differs
-- between the two engines.

ALTER TABLE jobs ADD COLUMN result_json TEXT;
