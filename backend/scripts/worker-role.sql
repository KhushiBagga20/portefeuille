-- Run once as the database administrator AFTER migrations, in the portfolio database.
-- Create a separate login through your database host and grant this role to that login.
-- Do NOT run the worker with the migration/API administrator account in production.
CREATE ROLE portfolio_worker NOLOGIN;
GRANT USAGE ON SCHEMA public TO portfolio_worker;
GRANT SELECT ON projects, publications, repositories, deliveries, evidence, revisions, jobs TO portfolio_worker;
GRANT INSERT ON evidence, revisions, revision_evidence TO portfolio_worker;
GRANT UPDATE ON jobs TO portfolio_worker;
-- There is intentionally no INSERT/UPDATE/DELETE grant on publications, owner_sessions or projects.
