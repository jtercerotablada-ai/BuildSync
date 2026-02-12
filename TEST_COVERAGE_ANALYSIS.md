# BuildSync Test Coverage Analysis

## Current State

**Test coverage: 0%.** The codebase has no test files, no test framework installed, and no test scripts configured. The `.gitignore` references a `/coverage` directory, but no testing infrastructure exists.

- **Source files**: ~184 TypeScript/TSX files
- **Test files**: 0
- **Test framework**: None installed
- **Test scripts**: None in `package.json`

---

## Recommended Testing Stack

| Tool | Purpose |
|---|---|
| **Vitest** | Unit/integration test runner (fast, native ESM, works well with Next.js) |
| **@testing-library/react** | Component testing with user-centric queries |
| **msw** (Mock Service Worker) | API mocking for integration tests |
| **@prisma/client mock** or **prisma-mock** | Database layer mocking |
| **Playwright** | End-to-end tests (future phase) |

---

## Priority Areas for Test Coverage

### Priority 1 (Critical) — Pure Business Logic

These modules contain complex calculations and decision logic that can be unit-tested without any mocking infrastructure. They are the highest-value, lowest-effort targets.

#### 1.1 Goal Progress Calculations (`src/lib/goal-progress.ts`)

This is the single most important file to test. It contains the `GoalProgressService` with multiple calculation methods that drive the OKR feature.

**Functions to test:**

| Function | Why it matters | Key test cases |
|---|---|---|
| `calculateFromKeyResults` | Computes OKR progress from key result values | Empty array returns 0; single KR at 50%; multiple KRs averaged; `startValue === targetValue` edge case (division by zero guard); negative progress clamped to 0; overshoot clamped to 100 |
| `calculateFromSubObjectives` | Averages child objective progress | Empty array returns 0; single child; multiple children with varying progress; children at 0% and 100% |
| `calculateFromProjects` | Derives progress from task completion ratios | No projects returns 0; projects with no tasks returns 0; partial completion across multiple projects; all tasks completed = 100% |
| `recalculateProgress` | Orchestrates the above based on `progressSource` | MANUAL source returns existing progress untouched; KEY_RESULTS delegates correctly; recursive parent recalculation; nonexistent objective throws |

**Example edge cases unique to this module:**
- A key result with `startValue: 10`, `targetValue: 10`, `currentValue: 10` — the range is 0, should return 100 not NaN
- A key result with `startValue: 10`, `targetValue: 10`, `currentValue: 5` — range is 0, current < target, should return 0
- A project with 100 tasks, 99 completed — should be 99%, not rounded to 100%

#### 1.2 Widget Preferences Hook (`src/hooks/use-widget-preferences.ts`)

State management logic that handles localStorage persistence and widget ordering.

**Test cases:**
- Default preferences include only `defaultEnabled` widgets, sorted by `defaultOrder`
- `toggleWidget` adds a widget not currently visible
- `toggleWidget` removes a visible widget from both `visibleWidgets` and `widgetOrder`
- `reorderWidgets` updates order without affecting visibility
- `setWidgetSize` stores the size for a specific widget
- `getWidgetSize` returns `'half'` as default when no size is stored
- `resetToDefaults` restores initial state
- Corrupted localStorage JSON is handled gracefully (no crash)
- Legacy data without `widgetSizes` is migrated correctly

#### 1.3 Dashboard Types & Constants (`src/types/dashboard.ts`)

**Test cases:**
- `AVAILABLE_WIDGETS` has unique IDs
- `AVAILABLE_WIDGETS` has unique `defaultOrder` values
- All `defaultEnabled: true` widgets have a `defaultOrder` < any `defaultEnabled: false` widget (ordering invariant)

---

### Priority 2 (High) — API Route Handlers

Every API route follows a similar pattern: authenticate, validate input, query/mutate database, return response. These should be tested with mocked Prisma calls.

#### 2.1 Authentication & Registration (`src/app/api/auth/register/route.ts`)

**Test cases:**
- Valid email + name creates a new user, returns 201
- Duplicate email with existing password returns 400
- Duplicate email without password (incomplete registration) returns 200 to allow re-entry
- Invalid email format returns 400 with validation error
- Missing required fields returns 400
- Email is normalized (trimmed, lowercased) before storage

**Potential bug to verify:** Two concurrent registrations with the same email — is there a race condition between the existence check and the create?

#### 2.2 Tasks API (`src/app/api/tasks/route.ts`)

**Test cases:**

| Scenario | Expected |
|---|---|
| Unauthenticated request | 401 |
| Create task with valid data | 201, task returned with correct fields |
| Create task without `assigneeId` | Auto-assigns to current user |
| Create task with invalid `priority` | 400 validation error |
| GET tasks filtered by `projectId` | Returns only tasks in that project |
| GET tasks with `myTasks=true` | Returns only tasks assigned to current user |
| GET tasks with `completed=true` | Returns only completed tasks |
| Create task with `parentTaskId` | Sets up subtask relationship |
| Task position ordering | New task gets position after last task in section |

#### 2.3 Projects API (`src/app/api/projects/route.ts`)

**Test cases:**
- Create project with template instantiation: sections and tasks are created correctly
- Create project without a workspace auto-creates one
- User without workspace membership gets 403
- Template-based project applies relative due dates from start date
- GET filters by visibility (PUBLIC, WORKSPACE) and membership

#### 2.4 Objectives API (`src/app/api/objectives/route.ts`)

**Test cases:**
- Create objective with valid data
- Create objective with `parentId` links to parent correctly
- GET with `parentId=null` returns only top-level objectives
- GET with `ownerId=me` returns current user's objectives
- Progress is calculated inline for response (verify key result aggregation)

#### 2.5 Teams API (`src/app/api/teams/route.ts`)

**Test cases:**
- Create team adds creator as LEAD
- Additional `memberIds` are added correctly
- Duplicate member IDs in `memberIds` (creator ID included again) don't cause errors
- GET returns teams based on membership and privacy settings

---

### Priority 3 (Medium) — React Components

Focus on components with significant interactivity, conditional rendering, or business logic.

#### 3.1 Task Detail Panel (`src/components/tasks/task-detail-panel.tsx`)

- Renders task data correctly (title, description, assignee, due date, priority)
- Editing a field triggers the correct mutation
- Subtask list renders and allows creation
- Comments section loads and displays
- Close button / ESC key dismisses the panel

#### 3.2 Board View (`src/components/views/board-view.tsx`)

- Renders columns for each section
- Tasks appear in correct columns
- Drag-and-drop reorders tasks (verify state update, not DOM mechanics)
- Empty sections show empty state

#### 3.3 Create Project Dialog (`src/components/projects/create-project-dialog.tsx`)

- Form validation prevents empty project name
- Template selection populates sections
- Submit calls the API with correct payload
- Error state is displayed on API failure

#### 3.4 Goal Progress Chart (`src/components/goals/goal-progress-chart.tsx`)

- Renders progress bar at correct percentage
- Handles 0% and 100% boundary values
- Color coding matches status thresholds

#### 3.5 Sidebar Navigation (`src/components/layout/sidebar.tsx`)

- Active route is highlighted
- All navigation links render correctly
- Collapsed/expanded state toggles

---

### Priority 4 (Lower) — Integration & Edge Cases

These tests require more infrastructure (database seeding, multi-step flows) but catch real-world bugs.

#### 4.1 Goal Progress Recalculation Chain

- Updating a key result value triggers objective recalculation
- Objective recalculation propagates to parent objective
- Changing a task's completion status recalculates connected objectives
- Circular parent references don't cause infinite recursion

#### 4.2 Project Template Instantiation

- Creating a project from a template creates all expected sections
- Tasks reference correct sections by index
- Subtasks are linked to parent tasks
- Relative due dates are calculated from project start date

#### 4.3 Authorization Boundaries

- User A cannot access User B's workspace resources
- Team privacy settings (PRIVATE, PUBLIC, REQUEST_TO_JOIN) filter correctly
- Project visibility (PRIVATE, WORKSPACE, PUBLIC) is enforced on GET
- Workspace role (OWNER, ADMIN, MEMBER, GUEST) affects allowed operations

---

## Specific Bugs & Risks Identified During Analysis

These are areas where tests would likely uncover existing issues:

1. **Race condition in task position calculation** (`src/app/api/tasks/route.ts`): The position for a new task is computed with a `findFirst` query, then used in a separate `create` call. Concurrent task creation can produce duplicate positions.

2. **No pagination on list endpoints**: GET endpoints for tasks, projects, objectives, and teams return unbounded result sets. Under load, these could cause performance degradation or OOM errors.

3. **Weak foreign key validation**: API routes accept IDs (e.g., `parentTaskId`, `assigneeId`, `teamId`) without verifying they exist in the user's workspace. A user could reference resources from another workspace if they know the ID.

4. **Registration race condition** (`src/app/api/auth/register/route.ts`): The check for existing user and the creation of a new user are not atomic. Two simultaneous registrations with the same email could both succeed.

5. **Template section index mapping** (`src/app/api/projects/route.ts`): Template tasks reference sections by array index. If a template defines a `sectionIndex` that exceeds the number of sections created, the task silently gets no section assignment instead of erroring.

6. **Goal progress with zero-range key results**: When `startValue === targetValue`, the code checks `currentValue >= targetValue` to return 100 or 0. This is correct but not obvious — tests should lock this behavior in.

---

## Suggested Implementation Order

```
Phase 1 — Foundation
  ├── Install Vitest + testing-library + msw
  ├── Configure test scripts in package.json
  ├── Set up Prisma mock utility
  └── Write tests for goal-progress.ts (highest business value)

Phase 2 — API Coverage
  ├── Auth registration route tests
  ├── Tasks CRUD route tests
  ├── Projects CRUD route tests
  ├── Objectives CRUD route tests
  └── Teams CRUD route tests

Phase 3 — Component Tests
  ├── Task detail panel
  ├── Board view
  ├── Create project dialog
  └── Goal progress chart

Phase 4 — Integration & E2E
  ├── Goal recalculation chains
  ├── Template instantiation flow
  ├── Authorization boundary tests
  └── Playwright E2E for critical paths
```

---

## Coverage Targets

| Phase | Target Coverage | Scope |
|---|---|---|
| After Phase 1 | ~15% | `src/lib/` fully covered |
| After Phase 2 | ~45% | All API routes covered |
| After Phase 3 | ~65% | Critical components covered |
| After Phase 4 | ~80% | Integration paths covered |

A minimum threshold of **80% line coverage** should be enforced in CI once Phase 4 is complete.
