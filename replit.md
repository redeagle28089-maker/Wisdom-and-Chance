# Replit Dashboard App

## Overview
A modern project management dashboard built with React, Express, and Replit. This app demonstrates best practices for building fullstack applications on Replit with proper separation of concerns, type safety, and a beautiful UI.

**Purpose:** Organize projects and tasks with a clean, professional interface.

**Current State:** MVP complete with CRUD operations for projects and tasks.

## Recent Changes
- **January 2026:** Initial build with complete project/task management functionality
  - Dashboard with stats overview
  - Project list with search and filter
  - Task management within projects
  - Dark/light theme support
  - Responsive sidebar navigation

## User Preferences
- Clean, professional design following Shadcn UI patterns
- Dark mode support
- In-memory storage (can be upgraded to PostgreSQL)

## Project Architecture

### Tech Stack
- **Frontend:** React 18, Tailwind CSS, Shadcn UI, Wouter (routing), TanStack Query
- **Backend:** Express.js, TypeScript
- **Storage:** In-memory (MemStorage class)

### Directory Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # Shadcn UI primitives
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   ├── project-card.tsx
│   │   │   ├── task-item.tsx
│   │   │   └── ...
│   │   ├── pages/          # Page components
│   │   │   ├── dashboard.tsx
│   │   │   ├── projects.tsx
│   │   │   ├── project-detail.tsx
│   │   │   └── settings.tsx
│   │   ├── lib/            # Utilities
│   │   └── App.tsx         # Main app with routing
│   └── index.html
├── server/
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # Data storage layer
│   └── index.ts            # Express server setup
├── shared/
│   └── schema.ts           # TypeScript types & Zod schemas
└── design_guidelines.md    # UI/UX design system
```

### API Endpoints
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project (and its tasks)
- `GET /api/tasks` - List all tasks (optional `?projectId=` filter)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Data Models
- **Project:** id, name, description, status, createdAt
- **Task:** id, projectId, title, description, status, priority, completed, createdAt

## Key Features
1. **Dashboard:** Stats overview with project counts, task metrics, and completion rate
2. **Projects:** List view with search, status filtering, and CRUD operations
3. **Tasks:** Within project detail view, with status/priority badges and toggle completion
4. **Theme:** Dark/light mode toggle with system preference detection
5. **Responsive:** Collapsible sidebar, mobile-friendly layouts

## Running the App
The app runs via `npm run dev` which starts both the Express backend and Vite frontend on port 5000.
