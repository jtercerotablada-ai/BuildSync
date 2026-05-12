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

  // ── Classic Asana-style widgets (opt-in via Customize) ──
  {
    id: 'my-tasks',
    title: 'My tasks',
    description: 'Tasks assigned to you',
    icon: 'CheckSquare',
    defaultEnabled: false,
    defaultOrder: 10,
  },
  {
    id: 'projects',
    title: 'Recent projects (classic)',
    description: 'Simple list of recently updated projects',
    icon: 'FolderKanban',
    defaultEnabled: false,
    defaultOrder: 11,
  },
  {
    id: 'goals',
    title: 'Goals (classic)',
    description: 'Original goals widget',
    icon: 'Target',
    defaultEnabled: false,
    defaultOrder: 12,
  },
  // === OPTIONAL WIDGETS ===
  {
    id: 'status-updates',
    title: 'Status updates',
    description: 'Recent project status updates',
    icon: 'TrendingUp',
    defaultEnabled: false,
    defaultOrder: 5,
  },
  {
    id: 'portfolios',
    title: 'Portfolios',
    description: 'Your portfolios',
    icon: 'Briefcase',
    defaultEnabled: false,
    defaultOrder: 6,
  },
  {
    id: 'assigned-tasks',
    title: "Tasks I've assigned",
    description: "Tasks you've assigned to others",
    icon: 'UserCheck',
    defaultEnabled: false,
    defaultOrder: 7,
  },
  {
    id: 'people',
    title: 'People',
    description: 'Frequent collaborators',
    icon: 'Users',
    defaultEnabled: false,
    defaultOrder: 8,
  },
  {
    id: 'private-notepad',
    title: 'Private notepad',
    titleIcon: 'lock',
    description: 'Add a quick note or link to an important resource',
    icon: 'StickyNote',
    defaultEnabled: false,
    defaultOrder: 9,
  },
  {
    id: 'draft-comments',
    title: 'Draft comments',
    description: "Comments you haven't sent yet",
    icon: 'MessageCircle',
    defaultEnabled: false,
    defaultOrder: 10,
  },
  {
    id: 'forms',
    title: 'Forms',
    description: 'Manage work request submissions',
    icon: 'FileText',
    defaultEnabled: false,
    defaultOrder: 11,
  },
  {
    id: 'mentions',
    title: 'Comments with mentions',
    titleIcon: 'info',
    description: 'Comments where you were @mentioned',
    icon: 'AtSign',
    defaultEnabled: false,
    defaultOrder: 12,
  },
  {
    id: 'learning',
    title: 'Learn TT',
    description: 'Tips and tutorials to get started',
    icon: 'GraduationCap',
    defaultEnabled: false,
    defaultOrder: 13,
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    titleIcon: 'sparkles',
    description: 'Ask questions and get help',
    icon: 'Sparkles',
    defaultEnabled: false,
    defaultOrder: 14,
  },
];
