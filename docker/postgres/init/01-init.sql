-- Initialize database for Commerce Base Plugin
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create additional databases for testing
CREATE DATABASE commerce_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE commerce_db TO commerce_user;
GRANT ALL PRIVILEGES ON DATABASE commerce_test TO commerce_user;

-- Create schemas for better organization
\c commerce_db;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant schema permissions
GRANT ALL ON SCHEMA commerce TO commerce_user;
GRANT ALL ON SCHEMA audit TO commerce_user;
GRANT ALL ON SCHEMA analytics TO commerce_user;