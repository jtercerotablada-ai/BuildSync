export type WidgetType =
  // ── Classic Asana-style widgets (kept from the original dashboard) ──
  | 'my-tasks'
  | 'projects'
  | 'goals'
  | 'assigned-tasks'
  | 'people'
  | 'status-updates'
  | 'portfolios'
  | 'private-notepad'
  | 'draft-comments'
  | 'forms'
  | 'mentions'
  | 'learning'
  | 'ai-assistant'
  // ── PMI-grade tiles introduced in the Home rebuild ───────────────
  | 'ai-brief'
  | 'priority-queue'
  | 'active-projects-pmi'
  | 'team-capacity'
  | 'upcoming-milestones'
  | 'recert-radar'
  | 'goals-snapshot-pmi'
  | 'recent-activity';

export interface WidgetConfig {
  id: WidgetType;
  title: string;
  titleIcon?: 'lock' | 'info' | 'sparkles';
  description: string;
  icon: string;
  defaultEnabled: boolean;
  defaultOrder: number;
}

export type WidgetSize = 'half' | 'full';

export interface UserWidgetPreferences {
  visibleWidgets: WidgetType[];
  widgetOrder: WidgetType[];
  widgetSizes: Partial<Record<WidgetType, WidgetSize>>;
}

// All widgets are the SAME SIZE
// 2-column grid, each widget takes 1 column
// Uniform height of ~320px for square aspect

export const AVAILABLE_WIDGETS: WidgetConfig[] = [
  // ── PMI-grade tiles (default home layout for engineering firms) ──
  {
    id: 'ai-brief',
    title: 'Brief',
    titleIcon: 'sparkles',
    description: 'What matters most across the portfolio right now',
    icon: 'Sparkles',
    defaultEnabled: true,
    defaultOrder: 0,
  },
  {
    id: 'priority-queue',
    title: 'Priority queue',
    description: 'Overdue and due-today items, urgency-sorted',
    icon: 'AlertTriangle',
    defaultEnabled: true,
    defaultOrder: 1,
  },
  {
    id: 'active-projects-pmi',
    title: 'Active projects',
    description: 'SPI + health + current gate per project',
    icon: 'FolderKanban',
    defaultEnabled: true,
    defaultOrder: 2,
  },
  {
    id: 'team-capacity',
    title: 'People',
    description: 'Capacity load relative to peak member',
    icon: 'Users',
    defaultEnabled: true,
    defaultOrder: 3,
  },
  {
    id: 'upcoming-milestones',
    title: 'Upcoming milestones',
    description: 'Next 14 days of priority work, grouped by day',
    icon: 'Flag',
    defaultEnabled: true,
    defaultOrder: 4,
  },
  {
    id: 'recert-radar',
    title: 'Recertification radar',
    description: 'Filings & permits due in the next 120 days',
    icon: 'ShieldCheck',
    defaultEnabled: true,
    defaultOrder: 5,
  },
  {
    id: 'goals-snapshot-pmi',
    title: 'Goals',
    description: 'Top OKRs with confidence score',
    icon: 'Target',
    defaultEnabled: true,
    defaultOrder: 6,
  },
  {
    id: 'recent-activity',
    title: 'Recent activity',
    description: 'Chronological feed across all projects',
    icon: 'Activity',
    defaultEnabled: true,
    defaultOrder: 7,
  },

  // ── Classic / Optional widgets (opt-in via Customize) ──
  // Defaults reserve 0-9 for the PMI tiles above; opt-in widgets
  // start at 100 so PMI tiles always render first even after the
  // user enables one of these. Each id has a UNIQUE order so the
  // sort is deterministic (the old layout had collisions where
  // e.g. recert-radar and status-updates both used order=5, which
  // made the grid shuffle on every load).
  {
    id: 'my-tasks',
    title: 'My tasks',
    description: 'Tasks assigned to you',
    icon: 'CheckSquare',
    defaultEnabled: false,
    defaultOrder: 100,
  },
  {
    id: 'projects',
    title: 'Recent projects (classic)',
    description: 'Simple list of recently updated projects',
    icon: 'FolderKanban',
    defaultEnabled: false,
    defaultOrder: 101,
  },
  {
    id: 'goals',
    title: 'Goals (classic)',
    description: 'Original goals widget',
    icon: 'Target',
    defaultEnabled: false,
    defaultOrder: 102,
  },
  {
    id: 'assigned-tasks',
    title: "Tasks I've assigned",
    description: "Tasks you've assigned to others",
    icon: 'UserCheck',
    defaultEnabled: false,
    defaultOrder: 103,
  },
  {
    id: 'people',
    title: 'People',
    description: 'Frequent collaborators',
    icon: 'Users',
    defaultEnabled: false,
    defaultOrder: 104,
  },
  {
    id: 'status-updates',
    title: 'Status updates',
    description: 'Recent project status updates',
    icon: 'TrendingUp',
    defaultEnabled: false,
    defaultOrder: 105,
  },
  {
    id: 'portfolios',
    title: 'Portfolios',
    description: 'Your portfolios',
    icon: 'Briefcase',
    defaultEnabled: false,
    defaultOrder: 106,
  },
  {
    id: 'private-notepad',
    title: 'Private notepad',
    titleIcon: 'lock',
    description: 'Add a quick note or link to an important resource',
    icon: 'StickyNote',
    defaultEnabled: false,
    defaultOrder: 107,
  },
  {
    id: 'draft-comments',
    title: 'Draft comments',
    // The list reads from uiState.draftComments but nothing in the
    // app writes to that key yet (no producer). The widget is kept
    // visible in Customize so the slot is reserved, but the
    // description is honest about the current state.
    description: 'Coming soon · saves unsent comments as drafts',
    icon: 'MessageCircle',
    defaultEnabled: false,
    defaultOrder: 108,
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Manage work request submissions',
    icon: 'FileText',
    defaultEnabled: false,
    defaultOrder: 109,
  },
  {
    id: 'mentions',
    title: 'Comments with mentions',
    titleIcon: 'info',
    description: 'Comments where you were @mentioned',
    icon: 'AtSign',
    defaultEnabled: false,
    defaultOrder: 110,
  },
  {
    id: 'learning',
    title: 'Learn TT',
    description: 'Tips and tutorials to get started',
    icon: 'GraduationCap',
    defaultEnabled: false,
    defaultOrder: 111,
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    titleIcon: 'sparkles',
    description: 'Ask questions and get help',
    icon: 'Sparkles',
    defaultEnabled: false,
    defaultOrder: 112,
  },
];
