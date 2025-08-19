-- Migration: Create individual_performance table
-- Version: 002
-- Date: 2025-07-22
-- Description: Create table for storing individual team member performance metrics

-- Individual performance table
CREATE TABLE individual_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    user_display_name VARCHAR(255),
    sprint_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_in_progress INTEGER DEFAULT 0,
    story_points_delivered INTEGER DEFAULT 0,
    story_points_committed INTEGER DEFAULT 0,
    bugs_created INTEGER DEFAULT 0,
    bugs_fixed INTEGER DEFAULT 0,
    code_review_count INTEGER DEFAULT 0,
    code_reviews_given INTEGER DEFAULT 0,
    pull_requests_created INTEGER DEFAULT 0,
    pull_requests_merged INTEGER DEFAULT 0,
    average_cycle_time DECIMAL(5,2), -- Average task cycle time in days
    average_lead_time DECIMAL(5,2), -- Average lead time in days
    task_completion_rate DECIMAL(5,2), -- Percentage of committed tasks completed
    quality_score DECIMAL(5,2), -- Quality score based on bugs/reviews/tests
    productivity_score DECIMAL(5,2), -- Productivity score calculation
    collaboration_score DECIMAL(5,2), -- Based on code reviews and team interactions
    sprint_start_date DATE,
    sprint_end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_email, sprint_id, product_id)
);

-- Add comments for documentation
COMMENT ON TABLE individual_performance IS 'Stores individual team member performance metrics by sprint';
COMMENT ON COLUMN individual_performance.user_email IS 'Team member email address (unique identifier)';
COMMENT ON COLUMN individual_performance.user_display_name IS 'Team member display name from Azure DevOps';
COMMENT ON COLUMN individual_performance.task_completion_rate IS 'Percentage of committed story points/tasks completed';
COMMENT ON COLUMN individual_performance.quality_score IS 'Quality score based on bugs created vs fixed, code review participation';
COMMENT ON COLUMN individual_performance.productivity_score IS 'Productivity score based on story points delivered and cycle time';
COMMENT ON COLUMN individual_performance.collaboration_score IS 'Collaboration score based on code reviews given/received and team interactions';

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_individual_performance_updated_at 
    BEFORE UPDATE ON individual_performance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for latest performance metrics per user
CREATE VIEW v_latest_individual_performance AS
SELECT DISTINCT ON (user_email) 
    user_email,
    user_display_name,
    sprint_id,
    product_id,
    tasks_completed,
    story_points_delivered,
    quality_score,
    productivity_score,
    collaboration_score,
    average_cycle_time,
    task_completion_rate,
    sprint_end_date,
    updated_at
FROM individual_performance 
ORDER BY user_email, sprint_end_date DESC, updated_at DESC;

COMMENT ON VIEW v_latest_individual_performance IS 'View showing the latest performance metrics for each team member';