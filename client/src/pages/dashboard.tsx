import { FolderKanban, CheckSquare, Clock, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { StatsCard } from "@/components/stats-card";
import { ProjectCard, ProjectCardSkeleton } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { Project, Task } from "@shared/schema";

interface DashboardPageProps {
  projects: Project[];
  tasks: Task[];
  isLoading?: boolean;
  onCreateProject: () => void;
}

export function DashboardPage({
  projects,
  tasks,
  isLoading,
  onCreateProject,
}: DashboardPageProps) {
  const stats = {
    totalProjects: projects.length,
    activeTasks: tasks.filter((t) => !t.completed).length,
    completedTasks: tasks.filter((t) => t.completed).length,
    completionRate:
      tasks.length > 0
        ? Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100)
        : 0,
  };

  const recentProjects = [...projects]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 4);

  return (
    <div className="space-y-8" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's an overview of your projects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Projects"
          value={stats.totalProjects}
          icon={FolderKanban}
          description="across all statuses"
          isLoading={isLoading}
        />
        <StatsCard
          title="Active Tasks"
          value={stats.activeTasks}
          icon={Clock}
          description="tasks in progress"
          isLoading={isLoading}
        />
        <StatsCard
          title="Completed Tasks"
          value={stats.completedTasks}
          icon={CheckSquare}
          description="tasks done"
          isLoading={isLoading}
        />
        <StatsCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          trend={
            stats.completionRate > 50
              ? { value: stats.completionRate - 50, isPositive: true }
              : undefined
          }
          description="of all tasks"
          isLoading={isLoading}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
          {projects.length > 0 && (
            <Button variant="ghost" asChild>
              <Link href="/projects" data-testid="link-view-all-projects">
                View all
              </Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to get started organizing your tasks."
            actionLabel="Create Project"
            onAction={onCreateProject}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={tasks.filter((t) => t.projectId === project.id).length}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
