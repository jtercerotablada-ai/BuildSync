export type WidgetType =
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
  | 'ai-assistant';

// IDs of widgets that were removed from the app but might still
// linger in some user's saved preferences. useWidgetPreferences
// filters these out on load so we never try to render a missing
// component. Kept here (not in the WidgetType union) so the type
// system still rejects them everywhere else.
export const REMOVED_WIDGET_IDS = [
  'ai-brief',
  'priority-queue',
  'active-projects-pmi',
  'team-capacity',
  'upcoming-milestones',
  'recert-radar',
  'goals-snapshot-pmi',
  'recent-activity',
] as const;

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
  // ── Defaults shown on a fresh home (defaultEnabled: true) ──
  //
  // The four below come on for every new user — covers personal
  // work, the project list, the team, and goals without overwhelming
  // the page. Everything else is opt-in via Customize.
  {
    id: 'my-tasks',
    title: 'My tasks',
    description: 'Tasks assigned to you',
    icon: 'CheckSquare',
    defaultEnabled: true,
    defaultOrder: 0,
  },
  {
    id: 'projects',
    title: 'Recent projects',
    description: 'Simple list of recently updated projects',
    icon: 'FolderKanban',
    defaultEnabled: true,
    defaultOrder: 1,
  },
  {
    id: 'people',
    title: 'People',
    description: 'Frequent collaborators',
    icon: 'Users',
    defaultEnabled: true,
    defaultOrder: 2,
  },
  {
    id: 'goals',
    title: 'Goals',
    description: 'Goals widget',
    icon: 'Target',
    defaultEnabled: true,
    defaultOrder: 3,
  },

  // ── Opt-in widgets ──
  // Each id has a UNIQUE order so the sort is deterministic.
  {
    id: 'assigned-tasks',
    title: "Tasks I've assigned",
    description: "Tasks you've assigned to others",
    icon: 'UserCheck',
    defaultEnabled: false,
    defaultOrder: 100,
  },
  {
    id: 'status-updates',
    title: 'Status updates',
    description: 'Recent project status updates',
    icon: 'TrendingUp',
    defaultEnabled: false,
    defaultOrder: 101,
  },
  {
    id: 'portfolios',
    title: 'Portfolios',
    description: 'Your portfolios',
    icon: 'Briefcase',
    defaultEnabled: false,
    defaultOrder: 102,
  },
  {
    id: 'private-notepad',
    title: 'Private notepad',
    titleIcon: 'lock',
    description: 'Add a quick note or link to an important resource',
    icon: 'StickyNote',
    defaultEnabled: false,
    defaultOrder: 103,
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
    defaultOrder: 104,
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Manage work request submissions',
    icon: 'FileText',
    defaultEnabled: false,
    defaultOrder: 105,
  },
  {
    id: 'mentions',
    title: 'Comments with mentions',
    titleIcon: 'info',
    description: 'Comments where you were @mentioned',
    icon: 'AtSign',
    defaultEnabled: false,
    defaultOrder: 106,
  },
  {
    id: 'learning',
    title: 'Learn TT',
    description: 'Tips and tutorials to get started',
    icon: 'GraduationCap',
    defaultEnabled: false,
    defaultOrder: 107,
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    titleIcon: 'sparkles',
    description: 'Ask questions and get help',
    icon: 'Sparkles',
    defaultEnabled: false,
    defaultOrder: 108,
  },
];
