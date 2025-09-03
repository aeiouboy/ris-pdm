Title: Test Plan — Bug Classification Endpoint Three‑Tier Fallback (/api/metrics/bug-classification/:projectId)

Objective
- Validate the three-tier fallback logic in backend/routes/metrics.js for GET /api/metrics/bug-classification/:projectId.
- Ensure normal operation (Azure DevOps available), graceful fallback (Azure failure), and last-resort empty response are correct and stable.

Scope
- In-scope: backend API behavior, response structure, and fallback decisioning for the specific endpoint.
- Out-of-scope: frontend rendering, unrelated metrics endpoints, real Azure integration (mocked in tests), long-term cache correctness.

Architecture Overview
- Primary path: TaskDistributionService.getBugTypeDistribution(projectName, filters) + AzureDevOpsService.getBugsByEnvironment(env,…)
- Fallback path: TaskDistributionService.calculateTaskDistribution({ projectName, iterationPath: 'current', … }) and derive bugTypes/environment data from bugClassification.
- Last-resort: Return an empty but valid bugTypes and bugsByEnvironment payload to avoid client-side errors.

Assumptions
- Project name resolution via ProjectResolutionService maps frontend project IDs (e.g., Team - Product Management) to Azure project names (e.g., Product - Partner Management Platform).
- Authentication is enforced; tests provide a valid JWT.
- Services are mocked under Jest to simulate Azure/Task Distribution behaviors.

Test Data & Mocks
- Project: Team - Product Management → resolves to Product - Partner Management Platform.
- Primary success: getBugTypeDistribution returns totals and breakdowns; getBugsByEnvironment returns non-empty ‘Prod’ data when requested.
- Fallback: getBugTypeDistribution throws; calculateTaskDistribution returns mock bugClassification with environmentBreakdown.
- Last-resort: both getBugTypeDistribution and calculateTaskDistribution throw.

Test Cases
1) Primary success — Azure path works
   - Given: getBugTypeDistribution resolves with { totalBugs: 10, classified: 8, unclassified: 2, classificationRate: 80, … }.
   - And: environment=Prod query set; getBugsByEnvironment returns { count: 4, percentage: 40, bugs: [...] }.
   - When: GET /api/metrics/bug-classification/Team%20-%20Product%20Management?environment=Prod
   - Then: 200 OK with response.bugTypes.totalBugs=10 and bugsByEnvironment.Prod.count=4; cached=false; metadata.projectName resolved.

2) Fallback — Azure fails, use distribution mock
   - Given: getBugTypeDistribution throws; calculateTaskDistribution resolves with bugClassification { totalBugs: 6, unclassified: 1, classificationRate: 84, environmentBreakdown: { Prod: {count: 3}, … } }.
   - When: GET …/bug-classification/Team%20-%20Product%20Management
   - Then: 200 OK with response.bugTypes.totalBugs=6, classified=5; environment counts taken from breakdown, bugs arrays empty.

3) Last resort — both primary and fallback fail
   - Given: getBugTypeDistribution throws; calculateTaskDistribution throws.
   - When: GET …/bug-classification/Team%20-%20Product%20Management
   - Then: 200 OK with empty response: totalBugs=0, classified=0, classificationRate=0; default environments (Deploy/Prod/SIT/UAT) with count=0, bugs=[].

Validation Criteria
- Status codes: Always 200 OK for the three covered scenarios (route’s internal handling avoids 5xx).
- Structure: Response has keys bugTypes, bugsByEnvironment, insights, filters, metadata, cached.
- Mapping: metadata.projectName equals ‘Product - Partner Management Platform’ for Team - Product Management.
- Fallback correctness: Ensures expected calls occur (primary vs fallback) and environment data composition matches code paths.

TDD Approach
- Write failing tests for the three scenarios (primary, fallback, last-resort).
- Implement/adjust endpoint logic to satisfy tests (already completed by fix).
- Re-run tests and iterate until green.

Execution
- From backend/: npm test
- Focused run: npm test -- bug-classification-fallback (Jest will filter by file/test name)

Risks & Mitigations
- Flaky time-based values: Assertions avoid exact timestamps; focus on structural/semantic checks.
- Cache side effects: Endpoint uses per-request in-memory cache; tests rely on mocks to control flows; avoid brittle cache assertions.
- Server bootstrap side effects: Jest mocks for Azure service ensure initialization does not hit network.

Maintenance Notes
- If endpoint logic changes (e.g., new environments), update test fixtures and assertions accordingly.
- If project mapping evolves, ensure project resolution behavior still returns expected projectName in tests.

