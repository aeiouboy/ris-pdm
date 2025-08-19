-- Seed file: Test data for Performance Dashboard
-- Version: 001
-- Date: 2025-07-22
-- Description: Insert sample data for testing and development

-- Clear existing test data (optional, uncomment if needed)
-- DELETE FROM individual_performance WHERE product_id LIKE 'TEST_%';
-- DELETE FROM performance_metrics WHERE product_id LIKE 'TEST_%';
-- DELETE FROM work_items_cache WHERE work_item_id >= 90000;

-- Insert sample performance metrics
INSERT INTO performance_metrics (
    product_id, 
    sprint_id, 
    metric_date, 
    velocity, 
    bugs_created, 
    bugs_resolved, 
    story_points_completed, 
    story_points_committed, 
    team_satisfaction,
    cycle_time_avg,
    lead_time_avg,
    deployment_frequency,
    change_failure_rate,
    recovery_time_avg
) VALUES 
-- Product A - Recent sprints
('TEST_PRODUCT_A', 'Sprint_23', '2025-07-15', 42, 8, 12, 40, 45, 4.2, 3.5, 5.2, 3, 5.5, 2.1),
('TEST_PRODUCT_A', 'Sprint_22', '2025-07-01', 38, 15, 10, 35, 40, 3.8, 4.2, 6.1, 2, 8.2, 3.5),
('TEST_PRODUCT_A', 'Sprint_21', '2025-06-17', 35, 12, 18, 32, 38, 4.0, 3.8, 5.8, 4, 3.1, 1.8),
('TEST_PRODUCT_A', 'Sprint_20', '2025-06-03', 32, 20, 15, 30, 35, 3.5, 5.1, 7.2, 1, 12.5, 4.2),

-- Product B - Recent sprints  
('TEST_PRODUCT_B', 'Sprint_23', '2025-07-15', 28, 5, 8, 26, 30, 4.5, 2.8, 4.1, 5, 2.0, 1.2),
('TEST_PRODUCT_B', 'Sprint_22', '2025-07-01', 25, 7, 6, 23, 28, 4.1, 3.2, 4.8, 3, 4.5, 2.0),
('TEST_PRODUCT_B', 'Sprint_21', '2025-06-17', 30, 3, 9, 28, 32, 4.7, 2.5, 3.9, 6, 1.5, 0.8),
('TEST_PRODUCT_B', 'Sprint_20', '2025-06-03', 22, 12, 5, 20, 25, 3.2, 4.5, 6.5, 2, 9.8, 3.1),

-- Product C - Recent sprints
('TEST_PRODUCT_C', 'Sprint_23', '2025-07-15', 18, 15, 8, 16, 22, 3.0, 6.2, 8.5, 1, 15.2, 5.5),
('TEST_PRODUCT_C', 'Sprint_22', '2025-07-01', 20, 18, 12, 18, 25, 2.8, 5.8, 9.1, 1, 18.5, 6.2),
('TEST_PRODUCT_C', 'Sprint_21', '2025-06-17', 15, 25, 10, 12, 20, 2.5, 7.1, 10.2, 0, 22.0, 8.0),
('TEST_PRODUCT_C', 'Sprint_20', '2025-06-03', 12, 22, 8, 10, 18, 2.2, 8.5, 12.1, 1, 20.5, 7.5);

-- Insert sample individual performance data
INSERT INTO individual_performance (
    user_email,
    user_display_name,
    sprint_id,
    product_id,
    tasks_completed,
    tasks_in_progress,
    story_points_delivered,
    story_points_committed,
    bugs_created,
    bugs_fixed,
    code_review_count,
    code_reviews_given,
    pull_requests_created,
    pull_requests_merged,
    average_cycle_time,
    average_lead_time,
    task_completion_rate,
    quality_score,
    productivity_score,
    collaboration_score,
    sprint_start_date,
    sprint_end_date
) VALUES 
-- Product A Team - Sprint 23
('john.doe@company.com', 'John Doe', 'Sprint_23', 'TEST_PRODUCT_A', 8, 2, 13, 15, 2, 3, 12, 8, 5, 5, 3.2, 4.8, 86.7, 85.5, 92.1, 88.3, '2025-07-01', '2025-07-15'),
('jane.smith@company.com', 'Jane Smith', 'Sprint_23', 'TEST_PRODUCT_A', 6, 1, 10, 12, 1, 4, 15, 12, 4, 4, 2.8, 4.1, 83.3, 92.8, 87.5, 95.2, '2025-07-01', '2025-07-15'),
('mike.wilson@company.com', 'Mike Wilson', 'Sprint_23', 'TEST_PRODUCT_A', 7, 3, 12, 13, 3, 2, 8, 5, 6, 5, 4.1, 5.5, 92.3, 78.2, 89.7, 75.8, '2025-07-01', '2025-07-15'),
('sarah.brown@company.com', 'Sarah Brown', 'Sprint_23', 'TEST_PRODUCT_A', 5, 1, 8, 10, 0, 5, 18, 15, 3, 3, 2.5, 3.8, 80.0, 95.5, 85.2, 98.1, '2025-07-01', '2025-07-15'),

-- Product A Team - Sprint 22
('john.doe@company.com', 'John Doe', 'Sprint_22', 'TEST_PRODUCT_A', 6, 3, 11, 14, 4, 2, 10, 6, 4, 3, 4.5, 6.2, 78.6, 72.5, 83.4, 76.8, '2025-06-17', '2025-07-01'),
('jane.smith@company.com', 'Jane Smith', 'Sprint_22', 'TEST_PRODUCT_A', 7, 2, 9, 11, 2, 3, 13, 10, 5, 4, 3.8, 5.1, 81.8, 87.2, 85.6, 91.5, '2025-06-17', '2025-07-01'),
('mike.wilson@company.com', 'Mike Wilson', 'Sprint_22', 'TEST_PRODUCT_A', 5, 4, 8, 12, 5, 1, 6, 4, 3, 2, 5.2, 7.1, 66.7, 65.8, 72.3, 68.2, '2025-06-17', '2025-07-01'),
('sarah.brown@company.com', 'Sarah Brown', 'Sprint_22', 'TEST_PRODUCT_A', 8, 1, 12, 13, 1, 4, 16, 12, 4, 4, 3.2, 4.5, 92.3, 93.1, 91.8, 94.7, '2025-06-17', '2025-07-01'),

-- Product B Team - Sprint 23
('alex.jones@company.com', 'Alex Jones', 'Sprint_23', 'TEST_PRODUCT_B', 9, 1, 11, 12, 1, 2, 14, 10, 6, 6, 2.3, 3.5, 91.7, 88.5, 94.2, 89.8, '2025-07-01', '2025-07-15'),
('lisa.garcia@company.com', 'Lisa Garcia', 'Sprint_23', 'TEST_PRODUCT_B', 7, 2, 8, 10, 0, 3, 12, 8, 4, 4, 2.8, 4.2, 80.0, 95.2, 86.3, 92.1, '2025-07-01', '2025-07-15'),
('david.kim@company.com', 'David Kim', 'Sprint_23', 'TEST_PRODUCT_B', 6, 1, 7, 8, 2, 1, 9, 6, 3, 3, 3.5, 4.8, 87.5, 81.7, 88.9, 83.4, '2025-07-01', '2025-07-15'),

-- Product B Team - Sprint 22
('alex.jones@company.com', 'Alex Jones', 'Sprint_22', 'TEST_PRODUCT_B', 8, 2, 9, 11, 2, 1, 11, 8, 5, 4, 3.1, 4.1, 81.8, 82.3, 87.5, 85.7, '2025-06-17', '2025-07-01'),
('lisa.garcia@company.com', 'Lisa Garcia', 'Sprint_22', 'TEST_PRODUCT_B', 6, 3, 7, 9, 1, 2, 10, 7, 3, 3, 3.8, 5.2, 77.8, 89.1, 82.4, 88.6, '2025-06-17', '2025-07-01'),
('david.kim@company.com', 'David Kim', 'Sprint_22', 'TEST_PRODUCT_B', 5, 2, 6, 8, 3, 1, 7, 4, 2, 2, 4.2, 6.1, 75.0, 75.8, 78.9, 76.2, '2025-06-17', '2025-07-01'),

-- Product C Team - Sprint 23  
('emma.lee@company.com', 'Emma Lee', 'Sprint_23', 'TEST_PRODUCT_C', 4, 4, 5, 8, 5, 1, 5, 3, 2, 1, 7.2, 9.5, 62.5, 58.2, 65.7, 61.4, '2025-07-01', '2025-07-15'),
('ryan.taylor@company.com', 'Ryan Taylor', 'Sprint_23', 'TEST_PRODUCT_C', 3, 5, 4, 7, 6, 0, 4, 2, 1, 1, 8.1, 10.2, 57.1, 52.8, 58.9, 55.1, '2025-07-01', '2025-07-15'),
('olivia.chen@company.com', 'Olivia Chen', 'Sprint_23', 'TEST_PRODUCT_C', 5, 3, 6, 9, 3, 2, 7, 4, 3, 2, 6.5, 8.8, 66.7, 67.5, 72.1, 68.9, '2025-07-01', '2025-07-15');

-- Insert sample work items cache data
INSERT INTO work_items_cache (
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
    project_name,
    created_date,
    changed_date,
    closed_date,
    activated_date,
    resolved_date,
    tags,
    remaining_work,
    completed_work,
    original_estimate,
    effort,
    business_value,
    raw_data
) VALUES 
-- Product A Work Items
(90001, 'Implement user authentication system', 'User Story', 'john.doe@company.com', 'John Doe', 'Done', 8, 1, 'TEST_PRODUCT_A\\Features', 'TEST_PRODUCT_A\\Sprint_23', 'TEST_PRODUCT_A', '2025-07-01 09:00:00', '2025-07-14 16:30:00', '2025-07-14 16:30:00', '2025-07-02 10:00:00', '2025-07-14 16:30:00', '{security,authentication,backend}', 0, 8, 8, 8, 20, '{"originalFields": {"System.WorkItemType": "User Story"}}'),

(90002, 'Create login page UI', 'Task', 'jane.smith@company.com', 'Jane Smith', 'Done', 5, 2, 'TEST_PRODUCT_A\\Features', 'TEST_PRODUCT_A\\Sprint_23', 'TEST_PRODUCT_A', '2025-07-02 10:15:00', '2025-07-13 14:20:00', '2025-07-13 14:20:00', '2025-07-03 09:30:00', '2025-07-13 14:20:00', '{frontend,ui,authentication}', 0, 5, 5, 5, 15, '{"originalFields": {"System.WorkItemType": "Task"}}'),

(90003, 'Fix password validation bug', 'Bug', 'mike.wilson@company.com', 'Mike Wilson', 'Resolved', 3, 1, 'TEST_PRODUCT_A\\Features', 'TEST_PRODUCT_A\\Sprint_23', 'TEST_PRODUCT_A', '2025-07-05 11:30:00', '2025-07-12 15:45:00', '2025-07-12 15:45:00', '2025-07-06 08:15:00', '2025-07-12 15:45:00', '{bug,validation,security}', 0, 3, 2, 3, 10, '{"originalFields": {"System.WorkItemType": "Bug"}}'),

(90004, 'Setup dashboard layout', 'Task', 'sarah.brown@company.com', 'Sarah Brown', 'In Progress', 5, 2, 'TEST_PRODUCT_A\\Dashboard', 'TEST_PRODUCT_A\\Sprint_23', 'TEST_PRODUCT_A', '2025-07-08 13:20:00', '2025-07-15 10:30:00', NULL, '2025-07-09 09:00:00', NULL, '{frontend,dashboard,layout}', 2, 3, 5, 5, 12, '{"originalFields": {"System.WorkItemType": "Task"}}'),

(90005, 'Implement metrics API endpoints', 'Task', 'john.doe@company.com', 'John Doe', 'Active', 8, 1, 'TEST_PRODUCT_A\\Backend', 'TEST_PRODUCT_A\\Sprint_23', 'TEST_PRODUCT_A', '2025-07-10 14:00:00', '2025-07-15 11:15:00', NULL, '2025-07-11 08:30:00', NULL, '{backend,api,metrics}', 5, 3, 8, 8, 18, '{"originalFields": {"System.WorkItemType": "Task"}}'),

-- Product B Work Items
(90006, 'Optimize database queries', 'User Story', 'alex.jones@company.com', 'Alex Jones', 'Done', 13, 1, 'TEST_PRODUCT_B\\Performance', 'TEST_PRODUCT_B\\Sprint_23', 'TEST_PRODUCT_B', '2025-06-28 09:30:00', '2025-07-13 17:00:00', '2025-07-13 17:00:00', '2025-06-29 10:00:00', '2025-07-13 17:00:00', '{performance,database,optimization}', 0, 13, 13, 13, 25, '{"originalFields": {"System.WorkItemType": "User Story"}}'),

(90007, 'Add caching layer', 'Task', 'lisa.garcia@company.com', 'Lisa Garcia', 'Done', 8, 2, 'TEST_PRODUCT_B\\Performance', 'TEST_PRODUCT_B\\Sprint_23', 'TEST_PRODUCT_B', '2025-07-01 11:00:00', '2025-07-12 16:30:00', '2025-07-12 16:30:00', '2025-07-02 09:15:00', '2025-07-12 16:30:00', '{caching,performance,redis}', 0, 8, 8, 8, 16, '{"originalFields": {"System.WorkItemType": "Task"}}'),

(90008, 'Memory leak in chart component', 'Bug', 'david.kim@company.com', 'David Kim', 'Active', 5, 1, 'TEST_PRODUCT_B\\Frontend', 'TEST_PRODUCT_B\\Sprint_23', 'TEST_PRODUCT_B', '2025-07-07 15:20:00', '2025-07-15 12:45:00', NULL, '2025-07-08 10:30:00', NULL, '{bug,memory,frontend,charts}', 3, 2, 5, 5, 8, '{"originalFields": {"System.WorkItemType": "Bug"}}'),

-- Product C Work Items
(90009, 'Refactor legacy code module', 'Task', 'emma.lee@company.com', 'Emma Lee', 'New', 13, 3, 'TEST_PRODUCT_C\\Legacy', 'TEST_PRODUCT_C\\Sprint_23', 'TEST_PRODUCT_C', '2025-07-12 10:00:00', '2025-07-15 13:20:00', NULL, NULL, NULL, '{refactoring,legacy,technical-debt}', 13, 0, 13, 13, 5, '{"originalFields": {"System.WorkItemType": "Task"}}'),

(90010, 'Investigate performance issues', 'Bug', 'ryan.taylor@company.com', 'Ryan Taylor', 'Active', 8, 1, 'TEST_PRODUCT_C\\Performance', 'TEST_PRODUCT_C\\Sprint_23', 'TEST_PRODUCT_C', '2025-07-09 14:15:00', '2025-07-15 14:10:00', NULL, '2025-07-10 09:00:00', NULL, '{bug,performance,investigation}', 6, 2, 8, 8, 12, '{"originalFields": {"System.WorkItemType": "Bug"}}'),

-- Historical completed items for trend analysis
(90011, 'Implement search functionality', 'User Story', 'jane.smith@company.com', 'Jane Smith', 'Closed', 8, 2, 'TEST_PRODUCT_A\\Features', 'TEST_PRODUCT_A\\Sprint_22', 'TEST_PRODUCT_A', '2025-06-15 09:00:00', '2025-06-30 17:00:00', '2025-06-30 17:00:00', '2025-06-16 10:00:00', '2025-06-30 17:00:00', '{search,feature,frontend}', 0, 8, 8, 8, 20, '{"originalFields": {"System.WorkItemType": "User Story"}}'),

(90012, 'Setup CI/CD pipeline', 'Task', 'mike.wilson@company.com', 'Mike Wilson', 'Done', 13, 1, 'TEST_PRODUCT_A\\DevOps', 'TEST_PRODUCT_A\\Sprint_22', 'TEST_PRODUCT_A', '2025-06-16 11:30:00', '2025-06-29 16:45:00', '2025-06-29 16:45:00', '2025-06-17 08:30:00', '2025-06-29 16:45:00', '{devops,ci-cd,automation}', 0, 13, 13, 13, 15, '{"originalFields": {"System.WorkItemType": "Task"}}');

-- Update last_synced to current timestamp for all work items
UPDATE work_items_cache SET last_synced = CURRENT_TIMESTAMP WHERE work_item_id >= 90000;