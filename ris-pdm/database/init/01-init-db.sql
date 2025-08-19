-- RIS Performance Dashboard Database Initialization
-- This script creates the initial database schema

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ris_dashboard;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS metrics;

-- Set default schema
SET search_path TO ris_dashboard, public;

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'developer', 'viewer');
CREATE TYPE project_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE metric_type AS ENUM ('performance', 'quality', 'velocity', 'burndown');

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azure_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'developer',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azure_project_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team members association
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, project_id)
);

-- Performance metrics cache
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    metric_type metric_type NOT NULL,
    metric_data JSONB NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, project_id, metric_type, period_start, period_end)
);

-- Work items cache
CREATE TABLE IF NOT EXISTS work_items_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    azure_work_item_id INTEGER NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    type VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    assigned_to UUID REFERENCES users(id),
    created_date TIMESTAMP WITH TIME ZONE,
    changed_date TIMESTAMP WITH TIME ZONE,
    closed_date TIMESTAMP WITH TIME ZONE,
    story_points INTEGER,
    priority INTEGER,
    work_item_data JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(azure_work_item_id, project_id)
);

-- Audit log table
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System metrics table
CREATE TABLE metrics.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_azure_id ON users(azure_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_projects_azure_id ON projects(azure_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE INDEX IF NOT EXISTS idx_team_members_user_project ON team_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(user_id, project_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_period ON performance_metrics(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_project_type ON performance_metrics(project_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_expires ON performance_metrics(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_azure_id ON work_items_cache(azure_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_items_project ON work_items_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_assigned ON work_items_cache(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_type_state ON work_items_cache(type, state);
CREATE INDEX IF NOT EXISTS idx_work_items_dates ON work_items_cache(created_date, changed_date, closed_date);
CREATE INDEX IF NOT EXISTS idx_work_items_updated ON work_items_cache(last_updated);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_performance_metrics_data_gin ON performance_metrics USING gin(metric_data);
CREATE INDEX IF NOT EXISTS idx_work_items_data_gin ON work_items_cache USING gin(work_item_data);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_table_timestamp ON audit.audit_log(table_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON audit.audit_log(user_id, timestamp);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON metrics.system_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels_gin ON metrics.system_metrics USING gin(labels);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log(table_name, operation, old_data)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log(table_name, operation, old_data, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log(table_name, operation, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create audit triggers
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER projects_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Create function to clean expired metrics
CREATE OR REPLACE FUNCTION clean_expired_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM performance_metrics 
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO metrics.system_metrics(metric_name, metric_value, labels)
    VALUES ('expired_metrics_cleaned', deleted_count, '{"type": "cleanup"}'::jsonb);
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Create function to archive old work items
CREATE OR REPLACE FUNCTION archive_old_work_items(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move old work items to archive table (create if needed)
    CREATE TABLE IF NOT EXISTS work_items_archive (LIKE work_items_cache INCLUDING ALL);
    
    WITH archived_items AS (
        DELETE FROM work_items_cache 
        WHERE last_updated < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_old
        AND closed_date IS NOT NULL
        RETURNING *
    )
    INSERT INTO work_items_archive SELECT * FROM archived_items;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    INSERT INTO metrics.system_metrics(metric_name, metric_value, labels)
    VALUES ('work_items_archived', archived_count, jsonb_build_object('days_old', days_old));
    
    RETURN archived_count;
END;
$$ language 'plpgsql';

-- Grant permissions
GRANT USAGE ON SCHEMA ris_dashboard TO ${POSTGRES_USER:-ris_user};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ris_dashboard TO ${POSTGRES_USER:-ris_user};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ris_dashboard TO ${POSTGRES_USER:-ris_user};

GRANT USAGE ON SCHEMA audit TO ${POSTGRES_USER:-ris_user};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO ${POSTGRES_USER:-ris_user};

GRANT USAGE ON SCHEMA metrics TO ${POSTGRES_USER:-ris_user};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA metrics TO ${POSTGRES_USER:-ris_user};

-- Insert initial data
INSERT INTO projects (azure_project_id, name, description) VALUES
('product-data-service', 'Product - Data as a Service', 'Data service platform and APIs'),
('product-supplier-connect', 'Product - Supplier Connect', 'Supplier integration and management'),
('product-cfg-workflow', 'Product - CFG Workflow', 'Configuration workflow automation'),
('product-rts-onprem', 'Product - RTS-On-Prem', 'On-premise RTS solution')
ON CONFLICT (azure_project_id) DO NOTHING;

-- Create a summary view for dashboards
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    p.name as project_name,
    COUNT(DISTINCT tm.user_id) as team_size,
    COUNT(DISTINCT wi.id) as total_work_items,
    COUNT(DISTINCT wi.id) FILTER (WHERE wi.state = 'Done') as completed_items,
    COUNT(DISTINCT wi.id) FILTER (WHERE wi.state = 'Active') as active_items,
    COALESCE(SUM(wi.story_points) FILTER (WHERE wi.state = 'Done'), 0) as completed_story_points,
    COALESCE(SUM(wi.story_points), 0) as total_story_points
FROM projects p
LEFT JOIN team_members tm ON p.id = tm.project_id AND tm.left_at IS NULL
LEFT JOIN work_items_cache wi ON p.id = wi.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.name;

COMMENT ON DATABASE ${POSTGRES_DB:-ris_dashboard} IS 'RIS Performance Dashboard Database';
COMMENT ON SCHEMA ris_dashboard IS 'Main application schema';
COMMENT ON SCHEMA audit IS 'Audit logging schema';
COMMENT ON SCHEMA metrics IS 'System metrics schema';