-- Migration: Create performance indexes
-- Version: 004
-- Date: 2025-07-22
-- Description: Create indexes for optimal query performance across all tables

-- Performance Metrics Table Indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_product_sprint 
ON performance_metrics(product_id, sprint_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_date 
ON performance_metrics(metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_product_date 
ON performance_metrics(product_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_velocity 
ON performance_metrics(velocity DESC) WHERE velocity IS NOT NULL;

-- Individual Performance Table Indexes
CREATE INDEX IF NOT EXISTS idx_individual_perf_user_sprint 
ON individual_performance(user_email, sprint_id);

CREATE INDEX IF NOT EXISTS idx_individual_perf_product_sprint 
ON individual_performance(product_id, sprint_id);

CREATE INDEX IF NOT EXISTS idx_individual_perf_user_date 
ON individual_performance(user_email, sprint_end_date DESC);

CREATE INDEX IF NOT EXISTS idx_individual_perf_productivity 
ON individual_performance(productivity_score DESC) WHERE productivity_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_individual_perf_quality 
ON individual_performance(quality_score DESC) WHERE quality_score IS NOT NULL;

-- Work Items Cache Table Indexes
CREATE INDEX IF NOT EXISTS idx_work_items_assignee 
ON work_items_cache(assignee_email) WHERE assignee_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_iteration 
ON work_items_cache(iteration_path) WHERE iteration_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_state 
ON work_items_cache(state);

CREATE INDEX IF NOT EXISTS idx_work_items_type 
ON work_items_cache(item_type);

CREATE INDEX IF NOT EXISTS idx_work_items_priority 
ON work_items_cache(priority);

CREATE INDEX IF NOT EXISTS idx_work_items_changed_date 
ON work_items_cache(changed_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_items_created_date 
ON work_items_cache(created_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_items_closed_date 
ON work_items_cache(closed_date DESC) WHERE closed_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_last_synced 
ON work_items_cache(last_synced DESC);

CREATE INDEX IF NOT EXISTS idx_work_items_area_path 
ON work_items_cache(area_path) WHERE area_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_story_points 
ON work_items_cache(story_points) WHERE story_points > 0;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_work_items_assignee_state_iteration 
ON work_items_cache(assignee_email, state, iteration_path) 
WHERE assignee_email IS NOT NULL AND iteration_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_type_state_date 
ON work_items_cache(item_type, state, changed_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_items_active_items 
ON work_items_cache(assignee_email, changed_date DESC) 
WHERE state NOT IN ('Removed', 'Closed', 'Done', 'Resolved');

-- GIN indexes for JSONB and array columns
CREATE INDEX IF NOT EXISTS idx_work_items_raw_data_gin 
ON work_items_cache USING GIN (raw_data);

CREATE INDEX IF NOT EXISTS idx_work_items_tags_gin 
ON work_items_cache USING GIN (tags);

-- Partial indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_work_items_bugs_open 
ON work_items_cache(assignee_email, created_date DESC) 
WHERE item_type = 'Bug' AND state NOT IN ('Closed', 'Resolved', 'Done');

CREATE INDEX IF NOT EXISTS idx_work_items_user_stories_active 
ON work_items_cache(assignee_email, story_points DESC, changed_date DESC) 
WHERE item_type = 'User Story' AND state NOT IN ('Removed', 'Closed', 'Done');

CREATE INDEX IF NOT EXISTS idx_work_items_tasks_in_progress 
ON work_items_cache(assignee_email, changed_date DESC) 
WHERE item_type = 'Task' AND state IN ('Active', 'In Progress', 'New');

-- Covering indexes for frequently accessed columns
CREATE INDEX IF NOT EXISTS idx_work_items_dashboard_metrics 
ON work_items_cache(assignee_email, item_type, state, story_points, priority, changed_date);

-- Performance metrics aggregation indexes
CREATE INDEX IF NOT EXISTS idx_individual_perf_team_summary 
ON individual_performance(product_id, sprint_end_date DESC, productivity_score DESC, quality_score DESC);

-- Text search indexes (if needed for title/description search)
CREATE INDEX IF NOT EXISTS idx_work_items_title_search 
ON work_items_cache USING GIN (to_tsvector('english', title));

-- Statistics and analytics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_trends 
ON performance_metrics(product_id, metric_date, velocity, story_points_completed, bugs_resolved);

CREATE INDEX IF NOT EXISTS idx_individual_performance_trends 
ON individual_performance(user_email, sprint_end_date, story_points_delivered, tasks_completed);

-- Add index comments for maintenance
COMMENT ON INDEX idx_performance_metrics_product_sprint IS 'Primary lookup index for product and sprint combination';
COMMENT ON INDEX idx_individual_perf_user_sprint IS 'Primary lookup index for user performance by sprint';
COMMENT ON INDEX idx_work_items_assignee IS 'Primary lookup index for work items by assignee';
COMMENT ON INDEX idx_work_items_iteration IS 'Index for filtering work items by sprint/iteration';
COMMENT ON INDEX idx_work_items_dashboard_metrics IS 'Covering index for dashboard metric calculations';

-- Create statistics for query planner optimization
ANALYZE performance_metrics;
ANALYZE individual_performance;
ANALYZE work_items_cache;