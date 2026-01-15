export type WidgetType =
  | 'quick-overview'
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

// IMPORTANTE: TODOS los widgets son del MISMO TAMAÑO
// Grid de 2 columnas, cada widget ocupa 1 columna
// Altura uniforme de ~320px para aspecto cuadrado

export const AVAILABLE_WIDGETS: WidgetConfig[] = [
  // === WIDGETS HABILITADOS POR DEFECTO ===
  {
    id: 'my-tasks',
    title: 'My tasks',
    description: 'Tasks assigned to you',
    icon: 'CheckSquare',
    defaultEnabled: true,
    defaultOrder: 1,
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Your recent projects',
    icon: 'FolderKanban',
    defaultEnabled: true,
    defaultOrder: 2,
  },
  {
    id: 'goals',
    title: 'Goals',
    description: 'Track your objectives and key results',
    icon: 'Target',
    defaultEnabled: true,
    defaultOrder: 3,
  },
  {
    id: 'quick-overview',
    title: 'Quick overview',
    description: 'Task and project statistics at a glance',
    icon: 'BarChart3',
    defaultEnabled: true,
    defaultOrder: 4,
  },
  // === WIDGETS OPCIONALES ===
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
    title: 'Learn BuildSync',
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
