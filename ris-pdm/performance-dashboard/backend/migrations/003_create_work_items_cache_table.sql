-- Migration: Create work_items_cache table
-- Version: 003
-- Date: 2025-07-22
-- Description: Create table for caching Azure DevOps work items data

-- Work items cache table
CREATE TABLE work_items_cache (
    work_item_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    assignee_email VARCHAR(255),
    assignee_display_name VARCHAR(255),
    state VARCHAR(50) NOT NULL,
    story_points INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 4,
    area_path VARCHAR(255),
    iteration_path VARCHAR(255),
    parent_id INTEGER,
    project_name VARCHAR(100),
    created_date TIMESTAMP,
    changed_date TIMESTAMP,
    closed_date TIMESTAMP,
    activated_date TIMESTAMP,
    resolved_date TIMESTAMP,
    tags TEXT[], -- Array of tags
    remaining_work DECIMAL(5,2) DEFAULT 0,
    completed_work DECIMAL(5,2) DEFAULT 0,
    original_estimate DECIMAL(5,2) DEFAULT 0,
    effort DECIMAL(5,2) DEFAULT 0,
    business_value INTEGER DEFAULT 0,
    blocked_reason TEXT,
    kanban_column VARCHAR(100),
    sub_state VARCHAR(100),
    raw_data JSONB, -- Store complete Azure DevOps response
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments for documentation
COMMENT ON TABLE work_items_cache IS 'Caches Azure DevOps work items data for faster queries and historical tracking';
COMMENT ON COLUMN work_items_cache.work_item_id IS 'Azure DevOps work item ID (primary key)';
COMMENT ON COLUMN work_items_cache.item_type IS 'Work item type (Task, Bug, User Story, Feature, etc.)';
COMMENT ON COLUMN work_items_cache.story_points IS 'Story points assigned to the work item';
COMMENT ON COLUMN work_items_cache.priority IS 'Priority level (1=highest, 4=lowest)';
COMMENT ON COLUMN work_items_cache.tags IS 'Array of tags associated with the work item';
COMMENT ON COLUMN work_items_cache.raw_data IS 'Complete Azure DevOps API response in JSON format';
COMMENT ON COLUMN work_items_cache.last_synced IS 'Last time this record was synchronized with Azure DevOps';

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_work_items_cache_updated_at 
    BEFORE UPDATE ON work_items_cache 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate cycle time
CREATE OR REPLACE FUNCTION calculate_cycle_time(
    p_activated_date TIMESTAMP,
    p_closed_date TIMESTAMP
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF p_activated_date IS NULL OR p_closed_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN EXTRACT(EPOCH FROM (p_closed_date - p_activated_date)) / 86400.0; -- Convert to days
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate lead time
CREATE OR REPLACE FUNCTION calculate_lead_time(
    p_created_date TIMESTAMP,
    p_closed_date TIMESTAMP
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF p_created_date IS NULL OR p_closed_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN EXTRACT(EPOCH FROM (p_closed_date - p_created_date)) / 86400.0; -- Convert to days
END;
$$ LANGUAGE plpgsql;

-- Create view for active work items
CREATE VIEW v_active_work_items AS
SELECT 
    work_item_id,
    title,
    item_type,
    assignee_email,
    assignee_display_name,
    state,
    story_points,
    priority,
    area_path,
    iteration_path,
    created_date,
    changed_date,
    calculate_cycle_time(activated_date, closed_date) as cycle_time_days,
    calculate_lead_time(created_date, closed_date) as lead_time_days,
    tags,
    last_synced
FROM work_items_cache 
WHERE state NOT IN ('Removed', 'Closed', 'Done', 'Resolved')
AND last_synced > NOW() - INTERVAL '24 hours';

COMMENT ON VIEW v_active_work_items IS 'View showing active work items with calculated cycle and lead times';

-- Create view for completed work items with metrics
CREATE VIEW v_completed_work_items AS
SELECT 
    work_item_id,
    title,
    item_type,
    assignee_email,
    assignee_display_name,
    story_points,
    priority,
    area_path,
    iteration_path,
    created_date,
    closed_date,
    calculate_cycle_time(activated_date, closed_date) as cycle_time_days,
    calculate_lead_time(created_date, closed_date) as lead_time_days,
    remaining_work,
    completed_work,
    original_estimate,
    tags
FROM work_items_cache 
WHERE state IN ('Closed', 'Done', 'Resolved')
AND closed_date IS NOT NULL;

COMMENT ON VIEW v_completed_work_items IS 'View showing completed work items with performance metrics';