-- Migration: Create performance_metrics table
-- Version: 001
-- Date: 2025-07-22
-- Description: Create table for storing performance metrics by product and sprint

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(100) NOT NULL,
    sprint_id VARCHAR(100) NOT NULL,
    metric_date DATE NOT NULL,
    velocity INTEGER,
    bugs_created INTEGER DEFAULT 0,
    bugs_resolved INTEGER DEFAULT 0,
    story_points_completed INTEGER DEFAULT 0,
    story_points_committed INTEGER DEFAULT 0,
    team_satisfaction DECIMAL(3,2) CHECK (team_satisfaction >= 0 AND team_satisfaction <= 5),
    cycle_time_avg DECIMAL(5,2), -- Average cycle time in days
    lead_time_avg DECIMAL(5,2), -- Average lead time in days
    deployment_frequency INTEGER DEFAULT 0, -- Deployments per sprint
    change_failure_rate DECIMAL(5,2), -- Percentage of failed deployments
    recovery_time_avg DECIMAL(5,2), -- Average recovery time in hours
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, sprint_id, metric_date)
);

-- Add comments for documentation
COMMENT ON TABLE performance_metrics IS 'Stores aggregated performance metrics by product and sprint';
COMMENT ON COLUMN performance_metrics.velocity IS 'Story points completed in the sprint';
COMMENT ON COLUMN performance_metrics.team_satisfaction IS 'Team satisfaction score (1-5 scale)';
COMMENT ON COLUMN performance_metrics.cycle_time_avg IS 'Average time from start to completion in days';
COMMENT ON COLUMN performance_metrics.lead_time_avg IS 'Average time from request to delivery in days';
COMMENT ON COLUMN performance_metrics.deployment_frequency IS 'Number of deployments during the sprint';
COMMENT ON COLUMN performance_metrics.change_failure_rate IS 'Percentage of deployments that caused issues';
COMMENT ON COLUMN performance_metrics.recovery_time_avg IS 'Average time to recover from failures in hours';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_performance_metrics_updated_at 
    BEFORE UPDATE ON performance_metrics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();