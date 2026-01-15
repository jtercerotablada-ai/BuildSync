// Template data with real sections and tasks for project creation
// Based on Asana's template structure

export interface TemplateTask {
  name: string;
  description?: string;
  sectionIndex: number; // Which section this task belongs to
  priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  taskType?: "TASK" | "MILESTONE" | "APPROVAL";
  relativeDueDate?: number; // Days from project start (positive) or end (negative)
  subtasks?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface TemplateSection {
  name: string;
  description?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  preview: "list" | "board" | "calendar" | "timeline";
  icon?: string;
  color: string;
  isNew?: boolean;
  isTrusted?: boolean;
  company?: string;
  sections: TemplateSection[];
  tasks: TemplateTask[];
  defaultView: "LIST" | "BOARD" | "TIMELINE" | "CALENDAR";
}

// ==================== MARKETING TEMPLATES ====================

export const campaignManagement: TemplateDefinition = {
  id: "campaign-management",
  name: "Campaign management",
  description: "Plan, schedule, and track complex marketing campaigns with a workflow built to manage deadlines and deliverables.",
  category: "marketing",
  preview: "timeline",
  color: "#7C3AED",
  isTrusted: true,
  company: "ClassPass",
  defaultView: "TIMELINE",
  sections: [
    { name: "Planning", description: "Initial campaign planning and strategy" },
    { name: "Content Creation", description: "Creating campaign assets" },
    { name: "Review & Approval", description: "Internal review process" },
    { name: "Launch", description: "Campaign launch activities" },
    { name: "Analysis", description: "Post-campaign analysis" },
  ],
  tasks: [
    // Planning
    { name: "Define campaign objectives and KPIs", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Identify target audience", sectionIndex: 0, priority: "HIGH", relativeDueDate: 2 },
    { name: "Set campaign budget", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 3 },
    { name: "Create campaign timeline", sectionIndex: 0, priority: "HIGH", relativeDueDate: 4, taskType: "MILESTONE" },
    { name: "Select marketing channels", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 5 },
    // Content Creation
    { name: "Write campaign copy", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7, subtasks: [
      { name: "Draft headline options" },
      { name: "Write body copy" },
      { name: "Create CTAs" },
    ]},
    { name: "Design visual assets", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10, subtasks: [
      { name: "Create social media graphics" },
      { name: "Design email templates" },
      { name: "Prepare banner ads" },
    ]},
    { name: "Produce video content", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 12 },
    { name: "Set up landing page", sectionIndex: 1, priority: "HIGH", relativeDueDate: 14 },
    // Review & Approval
    { name: "Internal content review", sectionIndex: 2, priority: "HIGH", relativeDueDate: 15, taskType: "APPROVAL" },
    { name: "Legal compliance check", sectionIndex: 2, priority: "HIGH", relativeDueDate: 16 },
    { name: "Final approval from stakeholders", sectionIndex: 2, priority: "HIGH", relativeDueDate: 17, taskType: "APPROVAL" },
    // Launch
    { name: "Schedule social media posts", sectionIndex: 3, priority: "HIGH", relativeDueDate: 18 },
    { name: "Set up email automation", sectionIndex: 3, priority: "HIGH", relativeDueDate: 18 },
    { name: "Launch paid advertising", sectionIndex: 3, priority: "HIGH", relativeDueDate: 19 },
    { name: "Campaign go-live", sectionIndex: 3, priority: "HIGH", relativeDueDate: 20, taskType: "MILESTONE" },
    // Analysis
    { name: "Monitor campaign performance", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 25 },
    { name: "Compile performance report", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 30 },
    { name: "Conduct post-mortem meeting", sectionIndex: 4, priority: "LOW", relativeDueDate: 32 },
  ],
};

export const creativeRequests: TemplateDefinition = {
  id: "creative-requests",
  name: "Creative requests",
  description: "Track creative work requests, collect feedback, and manage each production stage to deliver assets on time.",
  category: "marketing",
  preview: "list",
  color: "#EC4899",
  isNew: true,
  defaultView: "LIST",
  sections: [
    { name: "New Requests", description: "Incoming creative requests" },
    { name: "In Review", description: "Requests being reviewed" },
    { name: "In Progress", description: "Active work" },
    { name: "Pending Feedback", description: "Waiting for stakeholder feedback" },
    { name: "Completed", description: "Delivered assets" },
  ],
  tasks: [
    { name: "[Example] Social media graphics for Q1 campaign", sectionIndex: 0, priority: "HIGH", subtasks: [
      { name: "Review creative brief" },
      { name: "Create initial concepts" },
      { name: "Refine based on feedback" },
    ]},
    { name: "[Example] Email header design", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Product photography", sectionIndex: 2, priority: "HIGH" },
  ],
};

export const contentCalendar: TemplateDefinition = {
  id: "content-calendar",
  name: "Content calendar",
  description: "Oversee content types, statuses, and channels to manage publications across teams.",
  category: "marketing",
  preview: "calendar",
  color: "#10B981",
  isTrusted: true,
  company: "AppLovin",
  defaultView: "CALENDAR",
  sections: [
    { name: "Ideas & Backlog", description: "Content ideas to explore" },
    { name: "In Production", description: "Content being created" },
    { name: "Ready for Review", description: "Content awaiting approval" },
    { name: "Scheduled", description: "Approved and scheduled" },
    { name: "Published", description: "Live content" },
  ],
  tasks: [
    { name: "[Example] Blog post: Industry trends 2026", sectionIndex: 0, priority: "MEDIUM", subtasks: [
      { name: "Research topic" },
      { name: "Write draft" },
      { name: "Add images" },
      { name: "SEO optimization" },
    ]},
    { name: "[Example] Social media: Product launch teaser", sectionIndex: 1, priority: "HIGH", relativeDueDate: 5 },
    { name: "[Example] Newsletter: Monthly roundup", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 7 },
  ],
};

export const socialMediaCalendar: TemplateDefinition = {
  id: "social-media-calendar",
  name: "Social media calendar",
  description: "Plan content by channel and campaign, set deadlines, and track approvals to publish on time.",
  category: "marketing",
  preview: "board",
  color: "#3B82F6",
  defaultView: "BOARD",
  sections: [
    { name: "Content Ideas", description: "Brainstorming content" },
    { name: "Creating", description: "In production" },
    { name: "Review", description: "Pending approval" },
    { name: "Scheduled", description: "Ready to post" },
    { name: "Posted", description: "Published content" },
  ],
  tasks: [
    { name: "[Example] Instagram Reel: Behind the scenes", sectionIndex: 0, priority: "LOW" },
    { name: "[Example] LinkedIn post: Company milestone", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Twitter thread: Tips series", sectionIndex: 1, priority: "LOW" },
  ],
};

export const eventPlanning: TemplateDefinition = {
  id: "event-planning",
  name: "Event planning",
  description: "Manage event tasks from planning to execution. Keep strategy, vendors, and promotion organized in one place.",
  category: "marketing",
  preview: "list",
  color: "#F59E0B",
  isNew: true,
  defaultView: "LIST",
  sections: [
    { name: "Pre-Planning", description: "Initial planning phase" },
    { name: "Logistics", description: "Venue, vendors, equipment" },
    { name: "Marketing & Promotion", description: "Event promotion" },
    { name: "Day-of Coordination", description: "Event day tasks" },
    { name: "Post-Event", description: "Follow-up activities" },
  ],
  tasks: [
    // Pre-Planning
    { name: "Define event goals and objectives", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Set event budget", sectionIndex: 0, priority: "HIGH", relativeDueDate: 2 },
    { name: "Choose event date and time", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3, taskType: "MILESTONE" },
    { name: "Create event timeline", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 5 },
    // Logistics
    { name: "Research and book venue", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7, subtasks: [
      { name: "Visit potential venues" },
      { name: "Compare pricing" },
      { name: "Sign contract" },
    ]},
    { name: "Hire catering", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Arrange A/V equipment", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 12 },
    { name: "Coordinate transportation", sectionIndex: 1, priority: "LOW", relativeDueDate: 14 },
    // Marketing
    { name: "Design event branding", sectionIndex: 2, priority: "HIGH", relativeDueDate: 8 },
    { name: "Create registration page", sectionIndex: 2, priority: "HIGH", relativeDueDate: 10 },
    { name: "Send invitations", sectionIndex: 2, priority: "HIGH", relativeDueDate: 15, taskType: "MILESTONE" },
    { name: "Promote on social media", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 16 },
    // Day-of
    { name: "Final venue walkthrough", sectionIndex: 3, priority: "HIGH", relativeDueDate: -1 },
    { name: "Coordinate vendor arrivals", sectionIndex: 3, priority: "HIGH", relativeDueDate: 0 },
    { name: "Manage registration desk", sectionIndex: 3, priority: "HIGH", relativeDueDate: 0 },
    // Post-Event
    { name: "Send thank you emails", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 1 },
    { name: "Gather attendee feedback", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 3 },
    { name: "Create event recap report", sectionIndex: 4, priority: "LOW", relativeDueDate: 7 },
  ],
};

export const productLaunch: TemplateDefinition = {
  id: "product-launch",
  name: "Product launch",
  description: "Plan and execute a product launch from start to reporting.",
  category: "marketing",
  preview: "list",
  color: "#8B5CF6",
  isNew: true,
  defaultView: "TIMELINE",
  sections: [
    { name: "Strategy", description: "Launch strategy and planning" },
    { name: "Pre-Launch", description: "Preparation activities" },
    { name: "Launch Day", description: "Launch activities" },
    { name: "Post-Launch", description: "Follow-up and analysis" },
  ],
  tasks: [
    // Strategy
    { name: "Define launch goals and success metrics", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Identify target audience segments", sectionIndex: 0, priority: "HIGH", relativeDueDate: 2 },
    { name: "Competitive analysis", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 3 },
    { name: "Develop messaging and positioning", sectionIndex: 0, priority: "HIGH", relativeDueDate: 5 },
    { name: "Create launch timeline", sectionIndex: 0, priority: "HIGH", relativeDueDate: 7, taskType: "MILESTONE" },
    // Pre-Launch
    { name: "Prepare product documentation", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10, subtasks: [
      { name: "Write user guides" },
      { name: "Create FAQ" },
      { name: "Prepare support materials" },
    ]},
    { name: "Create marketing assets", sectionIndex: 1, priority: "HIGH", relativeDueDate: 14 },
    { name: "Set up landing page", sectionIndex: 1, priority: "HIGH", relativeDueDate: 16 },
    { name: "Brief sales and support teams", sectionIndex: 1, priority: "HIGH", relativeDueDate: 18 },
    { name: "Conduct beta testing", sectionIndex: 1, priority: "HIGH", relativeDueDate: 20 },
    // Launch Day
    { name: "Publish press release", sectionIndex: 2, priority: "HIGH", relativeDueDate: 21 },
    { name: "Activate marketing campaigns", sectionIndex: 2, priority: "HIGH", relativeDueDate: 21 },
    { name: "Launch social media blitz", sectionIndex: 2, priority: "HIGH", relativeDueDate: 21 },
    { name: "Product launch", sectionIndex: 2, priority: "HIGH", relativeDueDate: 21, taskType: "MILESTONE" },
    // Post-Launch
    { name: "Monitor launch metrics", sectionIndex: 3, priority: "HIGH", relativeDueDate: 22 },
    { name: "Gather customer feedback", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 28 },
    { name: "Create launch report", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 35 },
  ],
};

// ==================== OPERATIONS & PMO TEMPLATES ====================

export const goalSettingOperations: TemplateDefinition = {
  id: "goal-setting-operations",
  name: "Goal setting operations",
  description: "Manage the goal-setting process across teams to enable alignment and progress toward company-wide objectives.",
  category: "operations",
  preview: "list",
  color: "#059669",
  isNew: true,
  defaultView: "LIST",
  sections: [
    { name: "Goal Planning", description: "Define company and team goals" },
    { name: "Team Alignment", description: "Align teams with objectives" },
    { name: "Execution", description: "Track goal progress" },
    { name: "Review", description: "Quarterly reviews" },
  ],
  tasks: [
    { name: "Define company-wide objectives", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Communicate goals to leadership", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Team goal-setting workshops", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7 },
    { name: "Align team goals with company objectives", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Set up goal tracking system", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 12 },
    { name: "Monthly progress check-ins", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 30 },
    { name: "Quarterly goal review", sectionIndex: 3, priority: "HIGH", relativeDueDate: 90, taskType: "MILESTONE" },
  ],
};

export const crossFunctionalProject: TemplateDefinition = {
  id: "cross-functional-project",
  name: "Cross-functional project plan",
  description: "Create tasks, add due dates, and organize work by stages to coordinate teams across your organization.",
  category: "operations",
  preview: "timeline",
  color: "#0891B2",
  defaultView: "TIMELINE",
  sections: [
    { name: "Initiation", description: "Project kickoff" },
    { name: "Planning", description: "Detailed planning" },
    { name: "Execution", description: "Active work" },
    { name: "Monitoring", description: "Track progress" },
    { name: "Closure", description: "Project completion" },
  ],
  tasks: [
    // Initiation
    { name: "Define project scope and objectives", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Identify stakeholders", sectionIndex: 0, priority: "HIGH", relativeDueDate: 2 },
    { name: "Assemble project team", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Project kickoff meeting", sectionIndex: 0, priority: "HIGH", relativeDueDate: 5, taskType: "MILESTONE" },
    // Planning
    { name: "Create work breakdown structure", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7 },
    { name: "Develop project schedule", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Allocate resources", sectionIndex: 1, priority: "HIGH", relativeDueDate: 12 },
    { name: "Identify risks and mitigation strategies", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 14 },
    // Execution
    { name: "Execute project tasks", sectionIndex: 2, priority: "HIGH", relativeDueDate: 15 },
    { name: "Weekly team sync meetings", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 20 },
    { name: "Cross-team coordination", sectionIndex: 2, priority: "HIGH", relativeDueDate: 25 },
    // Monitoring
    { name: "Track project metrics", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 30 },
    { name: "Status report to stakeholders", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 35 },
    { name: "Risk monitoring and updates", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 40 },
    // Closure
    { name: "Final deliverables review", sectionIndex: 4, priority: "HIGH", relativeDueDate: 50, taskType: "APPROVAL" },
    { name: "Project retrospective", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 52 },
    { name: "Document lessons learned", sectionIndex: 4, priority: "LOW", relativeDueDate: 55 },
    { name: "Project closure", sectionIndex: 4, priority: "HIGH", relativeDueDate: 56, taskType: "MILESTONE" },
  ],
};

export const workIntake: TemplateDefinition = {
  id: "work-intake",
  name: "Work intake",
  description: "Capture work requests, assign resources, and track approvals.",
  category: "operations",
  preview: "list",
  color: "#6366F1",
  isNew: true,
  defaultView: "LIST",
  sections: [
    { name: "New Requests", description: "Incoming work requests" },
    { name: "Triaging", description: "Evaluating and prioritizing" },
    { name: "Approved", description: "Ready to start" },
    { name: "In Progress", description: "Active work" },
    { name: "Completed", description: "Finished requests" },
  ],
  tasks: [
    { name: "[Example] Website update request", sectionIndex: 0, priority: "MEDIUM" },
    { name: "[Example] Data analysis project", sectionIndex: 1, priority: "HIGH" },
    { name: "[Example] Report generation", sectionIndex: 2, priority: "LOW" },
  ],
};

export const kanbanBoard: TemplateDefinition = {
  id: "kanban-board",
  name: "Kanban board",
  description: "Track accountability and progress of critical work on boards to meet deadlines.",
  category: "operations",
  preview: "board",
  color: "#F97316",
  isNew: true,
  defaultView: "BOARD",
  sections: [
    { name: "Backlog", description: "Work to be done" },
    { name: "To Do", description: "Ready to start" },
    { name: "In Progress", description: "Currently working on" },
    { name: "In Review", description: "Awaiting review" },
    { name: "Done", description: "Completed work" },
  ],
  tasks: [
    { name: "[Example] Task ready for work", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Task in progress", sectionIndex: 2, priority: "HIGH" },
    { name: "[Example] Task under review", sectionIndex: 3, priority: "MEDIUM" },
  ],
};

export const projectTimeline: TemplateDefinition = {
  id: "project-timeline",
  name: "Project timeline",
  description: "Define dependencies, milestones, and deadlines to keep your projects on track.",
  category: "operations",
  preview: "timeline",
  color: "#14B8A6",
  defaultView: "TIMELINE",
  sections: [
    { name: "Phase 1: Discovery", description: "Research and planning" },
    { name: "Phase 2: Design", description: "Design phase" },
    { name: "Phase 3: Development", description: "Build phase" },
    { name: "Phase 4: Testing", description: "QA and testing" },
    { name: "Phase 5: Launch", description: "Release" },
  ],
  tasks: [
    // Discovery
    { name: "Requirements gathering", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Stakeholder interviews", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Discovery complete", sectionIndex: 0, priority: "HIGH", relativeDueDate: 7, taskType: "MILESTONE" },
    // Design
    { name: "Create wireframes", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Design mockups", sectionIndex: 1, priority: "HIGH", relativeDueDate: 14 },
    { name: "Design approval", sectionIndex: 1, priority: "HIGH", relativeDueDate: 16, taskType: "APPROVAL" },
    // Development
    { name: "Set up development environment", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 17 },
    { name: "Build core features", sectionIndex: 2, priority: "HIGH", relativeDueDate: 28 },
    { name: "Development complete", sectionIndex: 2, priority: "HIGH", relativeDueDate: 35, taskType: "MILESTONE" },
    // Testing
    { name: "QA testing", sectionIndex: 3, priority: "HIGH", relativeDueDate: 40 },
    { name: "Bug fixes", sectionIndex: 3, priority: "HIGH", relativeDueDate: 45 },
    { name: "User acceptance testing", sectionIndex: 3, priority: "HIGH", relativeDueDate: 48 },
    // Launch
    { name: "Final preparations", sectionIndex: 4, priority: "HIGH", relativeDueDate: 50 },
    { name: "Go live", sectionIndex: 4, priority: "HIGH", relativeDueDate: 52, taskType: "MILESTONE" },
  ],
};

// ==================== PRODUCTIVITY TEMPLATES ====================

export const projectManagement: TemplateDefinition = {
  id: "project-management",
  name: "Project management",
  description: "Plan projects, assign tasks, and manage deadlines to keep work moving from start to delivery.",
  category: "productivity",
  preview: "board",
  color: "#4573D2",
  isNew: true,
  defaultView: "BOARD",
  sections: [
    { name: "To Do", description: "Work not yet started" },
    { name: "In Progress", description: "Active work" },
    { name: "Review", description: "Needs review" },
    { name: "Done", description: "Completed" },
  ],
  tasks: [
    { name: "[Example] Define project scope", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Create project plan", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Weekly status update", sectionIndex: 1, priority: "MEDIUM" },
  ],
};

export const meetingAgenda: TemplateDefinition = {
  id: "meeting-agenda",
  name: "Meeting agenda",
  description: "Record agenda topics, next steps, and pending actions to keep meetings productive.",
  category: "productivity",
  preview: "list",
  color: "#64748B",
  defaultView: "LIST",
  sections: [
    { name: "Agenda Items", description: "Topics to discuss" },
    { name: "Discussion Notes", description: "Meeting notes" },
    { name: "Action Items", description: "Follow-up tasks" },
    { name: "Completed", description: "Done items" },
  ],
  tasks: [
    { name: "[Example] Review last week's action items", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Project status updates", sectionIndex: 0, priority: "MEDIUM" },
    { name: "[Example] Open discussion", sectionIndex: 0, priority: "LOW" },
  ],
};

export const requestTracking: TemplateDefinition = {
  id: "request-tracking",
  name: "Request tracking",
  description: "Capture, prioritize, and monitor requests until completion.",
  category: "productivity",
  preview: "list",
  color: "#EF4444",
  isNew: true,
  defaultView: "LIST",
  sections: [
    { name: "New Requests", description: "Incoming requests" },
    { name: "Under Review", description: "Being evaluated" },
    { name: "Approved", description: "Ready to work" },
    { name: "In Progress", description: "Being worked on" },
    { name: "Completed", description: "Finished" },
  ],
  tasks: [
    { name: "[Example] Feature request: Dark mode", sectionIndex: 0, priority: "MEDIUM" },
    { name: "[Example] Bug report: Login issue", sectionIndex: 1, priority: "HIGH" },
  ],
};

export const newEmployeeChecklist: TemplateDefinition = {
  id: "new-employee-checklist",
  name: "New employee checklist",
  description: "Define onboarding steps, assign tasks with due dates, and track milestones.",
  category: "productivity",
  preview: "list",
  color: "#22C55E",
  defaultView: "LIST",
  sections: [
    { name: "Before Day 1", description: "Pre-arrival tasks" },
    { name: "Day 1", description: "First day activities" },
    { name: "Week 1", description: "First week tasks" },
    { name: "First 30 Days", description: "First month goals" },
    { name: "First 90 Days", description: "Onboarding completion" },
  ],
  tasks: [
    // Before Day 1
    { name: "Send welcome email", sectionIndex: 0, priority: "HIGH", relativeDueDate: -3 },
    { name: "Set up workstation", sectionIndex: 0, priority: "HIGH", relativeDueDate: -2 },
    { name: "Create accounts and access", sectionIndex: 0, priority: "HIGH", relativeDueDate: -1 },
    { name: "Prepare onboarding materials", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: -1 },
    // Day 1
    { name: "Welcome meeting with manager", sectionIndex: 1, priority: "HIGH", relativeDueDate: 0 },
    { name: "Office tour", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 0 },
    { name: "Complete HR paperwork", sectionIndex: 1, priority: "HIGH", relativeDueDate: 0 },
    { name: "Team introductions", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 0 },
    // Week 1
    { name: "Review company handbook", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 2 },
    { name: "Set up development environment", sectionIndex: 2, priority: "HIGH", relativeDueDate: 2 },
    { name: "Meet with team members 1:1", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 5 },
    { name: "Complete required training", sectionIndex: 2, priority: "HIGH", relativeDueDate: 5 },
    // 30 Days
    { name: "Shadow team on current projects", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 10 },
    { name: "Complete first small task", sectionIndex: 3, priority: "HIGH", relativeDueDate: 14 },
    { name: "30-day check-in with manager", sectionIndex: 3, priority: "HIGH", relativeDueDate: 30, taskType: "MILESTONE" },
    // 90 Days
    { name: "Take ownership of project area", sectionIndex: 4, priority: "HIGH", relativeDueDate: 45 },
    { name: "Contribute to team goals", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 60 },
    { name: "90-day performance review", sectionIndex: 4, priority: "HIGH", relativeDueDate: 90, taskType: "MILESTONE" },
  ],
};

export const oneOnOneMeeting: TemplateDefinition = {
  id: "one-on-one-meeting",
  name: "1:1 meeting agenda",
  description: "Track agenda topics, meeting notes, and next steps.",
  category: "productivity",
  preview: "list",
  color: "#A855F7",
  defaultView: "LIST",
  sections: [
    { name: "To Discuss", description: "Topics for this meeting" },
    { name: "Notes", description: "Discussion notes" },
    { name: "Action Items", description: "Follow-ups" },
    { name: "Done", description: "Completed" },
  ],
  tasks: [
    { name: "[Example] Career development check-in", sectionIndex: 0, priority: "MEDIUM" },
    { name: "[Example] Project blockers", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Feedback exchange", sectionIndex: 0, priority: "LOW" },
  ],
};

// ==================== DESIGN TEMPLATES ====================

export const webDesignProcess: TemplateDefinition = {
  id: "web-design-process",
  name: "Web design process",
  description: "Organize design stages, assign owners, and track feedback to keep work moving.",
  category: "design",
  preview: "board",
  color: "#EC4899",
  defaultView: "BOARD",
  sections: [
    { name: "Discovery", description: "Research phase" },
    { name: "Wireframing", description: "Low-fidelity designs" },
    { name: "Visual Design", description: "High-fidelity mockups" },
    { name: "Prototyping", description: "Interactive prototypes" },
    { name: "Handoff", description: "Ready for development" },
  ],
  tasks: [
    { name: "User research and personas", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Competitive analysis", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 3 },
    { name: "Information architecture", sectionIndex: 0, priority: "HIGH", relativeDueDate: 5 },
    { name: "Low-fidelity wireframes", sectionIndex: 1, priority: "HIGH", relativeDueDate: 8 },
    { name: "Wireframe review", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10, taskType: "APPROVAL" },
    { name: "Visual design system", sectionIndex: 2, priority: "HIGH", relativeDueDate: 14 },
    { name: "Page mockups", sectionIndex: 2, priority: "HIGH", relativeDueDate: 20 },
    { name: "Design review", sectionIndex: 2, priority: "HIGH", relativeDueDate: 22, taskType: "APPROVAL" },
    { name: "Interactive prototype", sectionIndex: 3, priority: "HIGH", relativeDueDate: 28 },
    { name: "Usability testing", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 32 },
    { name: "Design specs documentation", sectionIndex: 4, priority: "HIGH", relativeDueDate: 35 },
    { name: "Developer handoff", sectionIndex: 4, priority: "HIGH", relativeDueDate: 37, taskType: "MILESTONE" },
  ],
};

export const creativeAssetApproval: TemplateDefinition = {
  id: "creative-asset-approval",
  name: "Creative asset approval",
  description: "Share designs, collect feedback, and manage approvals to speed up creative work.",
  category: "design",
  preview: "board",
  color: "#F59E0B",
  defaultView: "BOARD",
  sections: [
    { name: "Draft", description: "Initial designs" },
    { name: "Internal Review", description: "Team feedback" },
    { name: "Client Review", description: "External feedback" },
    { name: "Revisions", description: "Making changes" },
    { name: "Approved", description: "Final assets" },
  ],
  tasks: [
    { name: "[Example] Brand logo redesign", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Marketing brochure", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Website banner", sectionIndex: 2, priority: "HIGH" },
  ],
};

export const designProjectPlan: TemplateDefinition = {
  id: "design-project-plan",
  name: "Design project plan",
  description: "Create repeatable workflows, assign tasks, and manage timelines to deliver design projects on time.",
  category: "design",
  preview: "timeline",
  color: "#7C3AED",
  defaultView: "TIMELINE",
  sections: [
    { name: "Brief & Research", description: "Understanding the problem" },
    { name: "Ideation", description: "Exploring solutions" },
    { name: "Design", description: "Creating designs" },
    { name: "Review & Iterate", description: "Feedback cycles" },
    { name: "Final Delivery", description: "Handoff" },
  ],
  tasks: [
    { name: "Review project brief", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Conduct user research", sectionIndex: 0, priority: "HIGH", relativeDueDate: 5 },
    { name: "Competitive analysis", sectionIndex: 0, priority: "MEDIUM", relativeDueDate: 7 },
    { name: "Brainstorming session", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Concept sketches", sectionIndex: 1, priority: "HIGH", relativeDueDate: 12 },
    { name: "Initial designs", sectionIndex: 2, priority: "HIGH", relativeDueDate: 18 },
    { name: "Design refinement", sectionIndex: 2, priority: "HIGH", relativeDueDate: 22 },
    { name: "Internal review", sectionIndex: 3, priority: "HIGH", relativeDueDate: 24, taskType: "APPROVAL" },
    { name: "Incorporate feedback", sectionIndex: 3, priority: "HIGH", relativeDueDate: 27 },
    { name: "Final approval", sectionIndex: 3, priority: "HIGH", relativeDueDate: 30, taskType: "APPROVAL" },
    { name: "Prepare deliverables", sectionIndex: 4, priority: "HIGH", relativeDueDate: 32 },
    { name: "Project handoff", sectionIndex: 4, priority: "HIGH", relativeDueDate: 35, taskType: "MILESTONE" },
  ],
};

export const userResearchSessions: TemplateDefinition = {
  id: "user-research-sessions",
  name: "User research sessions",
  description: "Plan sessions, record insights, and prioritize findings to make informed decisions.",
  category: "design",
  preview: "list",
  color: "#06B6D4",
  defaultView: "LIST",
  sections: [
    { name: "Planning", description: "Research planning" },
    { name: "Recruitment", description: "Finding participants" },
    { name: "Sessions", description: "Conducting research" },
    { name: "Analysis", description: "Synthesizing findings" },
    { name: "Reporting", description: "Sharing insights" },
  ],
  tasks: [
    { name: "Define research objectives", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Create discussion guide", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Recruit participants", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7 },
    { name: "Schedule sessions", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Conduct user interviews", sectionIndex: 2, priority: "HIGH", relativeDueDate: 15 },
    { name: "Synthesize findings", sectionIndex: 3, priority: "HIGH", relativeDueDate: 20 },
    { name: "Create research report", sectionIndex: 4, priority: "HIGH", relativeDueDate: 25 },
    { name: "Present findings to team", sectionIndex: 4, priority: "HIGH", relativeDueDate: 28, taskType: "MILESTONE" },
  ],
};

// ==================== ENGINEERING TEMPLATES ====================

export const engineeringProjectPlan: TemplateDefinition = {
  id: "engineering-project-plan",
  name: "Engineering project plan",
  description: "Break work into tasks with due dates, organized by priority and stage.",
  category: "engineering",
  preview: "list",
  color: "#3B82F6",
  defaultView: "LIST",
  sections: [
    { name: "Requirements", description: "Project requirements" },
    { name: "Design", description: "Technical design" },
    { name: "Implementation", description: "Development work" },
    { name: "Testing", description: "QA and testing" },
    { name: "Deployment", description: "Release" },
  ],
  tasks: [
    { name: "Gather requirements", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Create technical spec", sectionIndex: 0, priority: "HIGH", relativeDueDate: 5 },
    { name: "Architecture design", sectionIndex: 1, priority: "HIGH", relativeDueDate: 8 },
    { name: "API design", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Database schema design", sectionIndex: 1, priority: "HIGH", relativeDueDate: 12 },
    { name: "Set up project structure", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 14 },
    { name: "Implement core features", sectionIndex: 2, priority: "HIGH", relativeDueDate: 28 },
    { name: "Code review", sectionIndex: 2, priority: "HIGH", relativeDueDate: 30, taskType: "APPROVAL" },
    { name: "Write unit tests", sectionIndex: 3, priority: "HIGH", relativeDueDate: 32 },
    { name: "Integration testing", sectionIndex: 3, priority: "HIGH", relativeDueDate: 35 },
    { name: "Performance testing", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 38 },
    { name: "Prepare deployment", sectionIndex: 4, priority: "HIGH", relativeDueDate: 40 },
    { name: "Deploy to production", sectionIndex: 4, priority: "HIGH", relativeDueDate: 42, taskType: "MILESTONE" },
  ],
};

export const bugTracking: TemplateDefinition = {
  id: "bug-tracking",
  name: "Bug tracking",
  description: "File, assign, and prioritize bugs in one place to fix issues faster.",
  category: "engineering",
  preview: "board",
  color: "#EF4444",
  defaultView: "BOARD",
  sections: [
    { name: "New", description: "Newly reported bugs" },
    { name: "Triaged", description: "Evaluated and prioritized" },
    { name: "In Progress", description: "Being fixed" },
    { name: "In Review", description: "Code review" },
    { name: "Resolved", description: "Fixed and deployed" },
  ],
  tasks: [
    { name: "[Example] Login page not loading on Safari", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Form validation error", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Performance issue on dashboard", sectionIndex: 2, priority: "HIGH" },
  ],
};

export const sprintPlanning: TemplateDefinition = {
  id: "sprint-planning",
  name: "Sprint planning",
  description: "Define sprint goals, set milestones, and assign tasks to coordinate your team.",
  category: "engineering",
  preview: "list",
  color: "#8B5CF6",
  defaultView: "BOARD",
  sections: [
    { name: "Backlog", description: "Items to consider" },
    { name: "Sprint Backlog", description: "Committed for this sprint" },
    { name: "In Progress", description: "Currently working on" },
    { name: "In Review", description: "Ready for review" },
    { name: "Done", description: "Completed this sprint" },
  ],
  tasks: [
    { name: "Sprint planning meeting", sectionIndex: 0, priority: "HIGH", relativeDueDate: 0, taskType: "MILESTONE" },
    { name: "[Example] User story: Login flow", sectionIndex: 1, priority: "HIGH" },
    { name: "[Example] User story: Dashboard", sectionIndex: 1, priority: "MEDIUM" },
    { name: "Sprint review", sectionIndex: 4, priority: "HIGH", relativeDueDate: 14, taskType: "MILESTONE" },
  ],
};

export const sprintRetrospective: TemplateDefinition = {
  id: "sprint-retrospective",
  name: "Sprint retrospective",
  description: "Collect feedback, identify improvements, and assign follow-up tasks after each sprint.",
  category: "engineering",
  preview: "list",
  color: "#10B981",
  defaultView: "LIST",
  sections: [
    { name: "What went well", description: "Successes to celebrate" },
    { name: "What could improve", description: "Areas for improvement" },
    { name: "Action items", description: "Follow-up tasks" },
    { name: "Completed", description: "Done items" },
  ],
  tasks: [
    { name: "[Example] Good team communication", sectionIndex: 0, priority: "LOW" },
    { name: "[Example] Need better documentation", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Create documentation template", sectionIndex: 2, priority: "MEDIUM" },
  ],
};

export const softwareImplementation: TemplateDefinition = {
  id: "software-implementation",
  name: "Software implementation",
  description: "Plan setup, testing, training, and deployment stages to launch new tools.",
  category: "it",
  preview: "timeline",
  color: "#0EA5E9",
  defaultView: "TIMELINE",
  sections: [
    { name: "Planning", description: "Implementation planning" },
    { name: "Setup", description: "Configuration" },
    { name: "Testing", description: "Validation" },
    { name: "Training", description: "User training" },
    { name: "Go-Live", description: "Launch" },
  ],
  tasks: [
    { name: "Define implementation requirements", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Create implementation plan", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Install and configure software", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7 },
    { name: "Data migration", sectionIndex: 1, priority: "HIGH", relativeDueDate: 12 },
    { name: "Integration setup", sectionIndex: 1, priority: "HIGH", relativeDueDate: 15 },
    { name: "User acceptance testing", sectionIndex: 2, priority: "HIGH", relativeDueDate: 20 },
    { name: "Bug fixes and adjustments", sectionIndex: 2, priority: "HIGH", relativeDueDate: 25 },
    { name: "Create training materials", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 22 },
    { name: "Conduct user training", sectionIndex: 3, priority: "HIGH", relativeDueDate: 28 },
    { name: "Go-live checklist", sectionIndex: 4, priority: "HIGH", relativeDueDate: 30 },
    { name: "System go-live", sectionIndex: 4, priority: "HIGH", relativeDueDate: 32, taskType: "MILESTONE" },
    { name: "Post-launch support", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 40 },
  ],
};

export const ticketing: TemplateDefinition = {
  id: "ticketing",
  name: "Ticketing",
  description: "Collect, prioritize, and resolve tickets to keep your service goals on track.",
  category: "it",
  preview: "board",
  color: "#F97316",
  isNew: true,
  defaultView: "BOARD",
  sections: [
    { name: "New", description: "Incoming tickets" },
    { name: "Triaged", description: "Prioritized tickets" },
    { name: "In Progress", description: "Being worked on" },
    { name: "Pending", description: "Waiting on external" },
    { name: "Resolved", description: "Completed tickets" },
  ],
  tasks: [
    { name: "[Example] Password reset request", sectionIndex: 0, priority: "HIGH" },
    { name: "[Example] Software installation request", sectionIndex: 1, priority: "MEDIUM" },
    { name: "[Example] Network access issue", sectionIndex: 2, priority: "HIGH" },
  ],
};

// ==================== HR TEMPLATES ====================

export const candidateTracking: TemplateDefinition = {
  id: "candidate-tracking",
  name: "Candidate tracking",
  description: "Track candidates, schedule interviews, and manage hiring from application to offer.",
  category: "hr",
  preview: "board",
  color: "#8B5CF6",
  defaultView: "BOARD",
  sections: [
    { name: "Applied", description: "New applications" },
    { name: "Phone Screen", description: "Initial screening" },
    { name: "Interview", description: "In-person interviews" },
    { name: "Final Round", description: "Final interviews" },
    { name: "Offer", description: "Extending offers" },
    { name: "Hired", description: "Accepted offers" },
  ],
  tasks: [
    { name: "[Example] John Smith - Software Engineer", sectionIndex: 0, priority: "MEDIUM" },
    { name: "[Example] Jane Doe - Product Manager", sectionIndex: 2, priority: "HIGH" },
    { name: "[Example] Bob Johnson - Designer", sectionIndex: 4, priority: "HIGH" },
  ],
};

// ==================== SALES TEMPLATES ====================

export const customerOnboarding: TemplateDefinition = {
  id: "customer-onboarding",
  name: "Customer onboarding",
  description: "Track onboarding tasks, collect feedback in forms, and manage work across teams.",
  category: "sales",
  preview: "board",
  color: "#10B981",
  defaultView: "BOARD",
  sections: [
    { name: "Welcome", description: "Initial setup" },
    { name: "Training", description: "Product training" },
    { name: "Implementation", description: "Configuration" },
    { name: "Review", description: "Progress review" },
    { name: "Complete", description: "Onboarding done" },
  ],
  tasks: [
    { name: "Send welcome email and materials", sectionIndex: 0, priority: "HIGH", relativeDueDate: 0 },
    { name: "Schedule kickoff call", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Account setup and configuration", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Product overview training", sectionIndex: 1, priority: "HIGH", relativeDueDate: 5 },
    { name: "Advanced features training", sectionIndex: 1, priority: "MEDIUM", relativeDueDate: 10 },
    { name: "Import customer data", sectionIndex: 2, priority: "HIGH", relativeDueDate: 7 },
    { name: "Configure integrations", sectionIndex: 2, priority: "MEDIUM", relativeDueDate: 12 },
    { name: "30-day check-in call", sectionIndex: 3, priority: "HIGH", relativeDueDate: 30, taskType: "MILESTONE" },
    { name: "Gather feedback survey", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 35 },
    { name: "Onboarding complete", sectionIndex: 4, priority: "HIGH", relativeDueDate: 45, taskType: "MILESTONE" },
  ],
};

export const salesPipeline: TemplateDefinition = {
  id: "sales-pipeline",
  name: "Sales pipeline",
  description: "Automate pipeline steps, integrate with Salesforce, and track deals at a glance.",
  category: "sales",
  preview: "list",
  color: "#3B82F6",
  defaultView: "BOARD",
  sections: [
    { name: "Lead", description: "New leads" },
    { name: "Qualified", description: "Qualified opportunities" },
    { name: "Proposal", description: "Proposal sent" },
    { name: "Negotiation", description: "In negotiation" },
    { name: "Closed Won", description: "Won deals" },
    { name: "Closed Lost", description: "Lost deals" },
  ],
  tasks: [
    { name: "[Example] Acme Corp - Enterprise deal", sectionIndex: 1, priority: "HIGH" },
    { name: "[Example] TechStart Inc - SMB deal", sectionIndex: 2, priority: "MEDIUM" },
    { name: "[Example] Global Industries - Enterprise deal", sectionIndex: 3, priority: "HIGH" },
  ],
};

export const digitalFundraising: TemplateDefinition = {
  id: "digital-fundraising",
  name: "Digital fundraising campaign",
  description: "Plan timelines and manage approvals to keep the fundraising campaign on track.",
  category: "sales",
  preview: "list",
  color: "#EC4899",
  defaultView: "TIMELINE",
  sections: [
    { name: "Planning", description: "Campaign planning" },
    { name: "Content Creation", description: "Creating assets" },
    { name: "Launch", description: "Campaign launch" },
    { name: "Engagement", description: "Donor engagement" },
    { name: "Reporting", description: "Results and analysis" },
  ],
  tasks: [
    { name: "Define fundraising goals", sectionIndex: 0, priority: "HIGH", relativeDueDate: 1 },
    { name: "Identify target donors", sectionIndex: 0, priority: "HIGH", relativeDueDate: 3 },
    { name: "Create campaign messaging", sectionIndex: 1, priority: "HIGH", relativeDueDate: 7 },
    { name: "Design email templates", sectionIndex: 1, priority: "HIGH", relativeDueDate: 10 },
    { name: "Set up donation page", sectionIndex: 1, priority: "HIGH", relativeDueDate: 12 },
    { name: "Campaign launch", sectionIndex: 2, priority: "HIGH", relativeDueDate: 14, taskType: "MILESTONE" },
    { name: "Send launch emails", sectionIndex: 2, priority: "HIGH", relativeDueDate: 14 },
    { name: "Social media promotion", sectionIndex: 3, priority: "MEDIUM", relativeDueDate: 15 },
    { name: "Follow-up with donors", sectionIndex: 3, priority: "HIGH", relativeDueDate: 21 },
    { name: "Compile campaign results", sectionIndex: 4, priority: "HIGH", relativeDueDate: 30 },
    { name: "Send thank you notes", sectionIndex: 4, priority: "MEDIUM", relativeDueDate: 32 },
  ],
};

// ==================== ALL TEMPLATES COLLECTION ====================

export const allTemplates: TemplateDefinition[] = [
  // Marketing
  campaignManagement,
  creativeRequests,
  contentCalendar,
  socialMediaCalendar,
  eventPlanning,
  productLaunch,
  // Operations
  goalSettingOperations,
  crossFunctionalProject,
  workIntake,
  kanbanBoard,
  projectTimeline,
  // Productivity
  projectManagement,
  meetingAgenda,
  requestTracking,
  newEmployeeChecklist,
  oneOnOneMeeting,
  // Design
  webDesignProcess,
  creativeAssetApproval,
  designProjectPlan,
  userResearchSessions,
  // Engineering
  engineeringProjectPlan,
  bugTracking,
  sprintPlanning,
  sprintRetrospective,
  // IT
  softwareImplementation,
  ticketing,
  // HR
  candidateTracking,
  // Sales
  customerOnboarding,
  salesPipeline,
  digitalFundraising,
];

// Helper function to get template by ID
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return allTemplates.find(t => t.id === id);
}

// Helper function to get templates by category
export function getTemplatesByCategory(category: string): TemplateDefinition[] {
  return allTemplates.filter(t => t.category === category);
}

// Categories for the UI
export const templateCategories = [
  { id: "marketing", label: "Marketing", count: 6 },
  { id: "operations", label: "Operations & PMO", count: 5 },
  { id: "productivity", label: "Productivity", count: 5 },
  { id: "design", label: "Design", count: 4 },
  { id: "engineering", label: "Product & Engineering", count: 4 },
  { id: "it", label: "IT", count: 2 },
  { id: "hr", label: "HR", count: 1 },
  { id: "sales", label: "Sales & CX", count: 3 },
];
