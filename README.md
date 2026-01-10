# BuildSync - Project Management App

A modern project management application inspired by Asana, built with Next.js 16, TypeScript, Tailwind CSS, and Prisma.

## Features (Phase 1 MVP)

- **Authentication**: Email/password and Google OAuth via NextAuth.js
- **Workspaces**: Create and manage workspaces with team members
- **Projects**: Full CRUD with customizable colors and status tracking
- **Tasks**: Create, assign, prioritize, and track tasks with due dates
- **Views**: List view and Kanban board view with drag-and-drop
- **Task Detail Panel**: Comprehensive task editing with comments and activity history
- **My Tasks**: Personal task dashboard
- **Home Dashboard**: Overview with widgets

## Tech Stack

- **Frontend**: Next.js 16, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State/DnD**: Zustand, @dnd-kit
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- npm

### Setup

1. **Start the database**:
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   The `.env` file is already configured for local development. For production, update:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `NEXTAUTH_SECRET` - A secure random string
   - `NEXTAUTH_URL` - Your app URL
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - For Google OAuth (optional)

4. **Run database migrations**:
   ```bash
   npx prisma db push
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login and register pages
│   ├── (dashboard)/     # Main app pages (home, my-tasks, projects, inbox)
│   ├── api/             # API routes
│   └── layout.tsx       # Root layout
├── components/
│   ├── home/            # Home dashboard widgets
│   ├── layout/          # Sidebar, Header, DashboardShell
│   ├── projects/        # Project-related components
│   ├── providers/       # Context providers
│   ├── tasks/           # Task components
│   ├── ui/              # shadcn/ui components
│   └── views/           # List view, Board view
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── auth-utils.ts    # Auth helper functions
│   ├── prisma.ts        # Prisma client singleton
│   └── utils.ts         # Utility functions
├── types/
│   └── next-auth.d.ts   # TypeScript type extensions
└── prisma/
    └── schema.prisma    # Database schema
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Workspaces
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create workspace

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List tasks (with filters)
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/comments` - List comments
- `POST /api/tasks/:id/comments` - Add comment

## Development

```bash
# Run development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Database Commands

```bash
# Push schema changes
npx prisma db push

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database
npx prisma db push --force-reset
```

## Roadmap

### Phase 2: Collaboration
- Comments with @mentions
- Activity history
- Real-time updates (WebSocket)
- File attachments
- Notifications

### Phase 3: Advanced Views
- Timeline/Gantt chart
- Calendar view
- Dashboard with charts
- Custom fields

### Phase 4: Productivity
- Portfolios
- Goals/OKRs
- Automation workflows
- Forms

### Phase 5: Enterprise
- Teams
- Admin console
- SSO/SAML
- API & Webhooks

---

Built for **Tercero Tablada Engineering**
