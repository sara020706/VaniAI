-- VaniAI: create the MLflow backend-store database.
-- Mounted into /docker-entrypoint-initdb.d/ of the postgres container; the
-- official entrypoint executes it exactly once, when the data directory is
-- first initialised. The application database (`vaniai`) is created by the
-- POSTGRES_DB environment variable; this script adds the second database.

CREATE DATABASE mlflow OWNER vaniai;
GRANT ALL PRIVILEGES ON DATABASE mlflow TO vaniai;
