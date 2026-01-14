import { useState } from "react";
import { Link } from "wouter";
import { Plus, ArrowLeft, CheckSquare, ListTodo, Clock } from "lucide-react";
import { TaskItem, TaskItemSkeleton } from "@/components/task-item";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { Project, Task } from "@shared/schema";

interface ProjectDetailPageProps {
  project: Project | null;
  tasks: Task[];
  isLoading?: boolean;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onToggleTask: (task: Task, completed: boolean) => void;
}

export function ProjectDetailPage({
  project,
  tasks,
  isLoading,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: ProjectDetailPageProps) {
  const [activeTab, setActiveTab] = useState("all");

  if (!project && !isLoading) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Project not found"
        description="The project you're looking for doesn't exist or has been deleted."
        actionLabel="Back to Projects"
        onAction={() => window.history.back()}
      />
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    archived: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return !task.completed;
    if (activeTab === "completed") return task.completed;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="page-project-detail">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground transition-colors" data-testid="link-back-projects">
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground">{project?.name || "Loading..."}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          {isLoading ? (
            <>
              <div className="h-9 w-48 bg-muted rounded animate-pulse" />
              <div className="h-5 w-64 bg-muted rounded animate-pulse" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {project?.name}
                </h1>
                <Badge
                  variant="outline"
                  className={`capitalize ${statusColors[project?.status || "active"]}`}
                >
                  {project?.status}
                </Badge>
              </div>
              {project?.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </>
          )}
        </div>
        <Button onClick={onCreateTask} data-testid="button-create-task">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount} / {tasks.length} tasks
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{tasks.filter((t) => !t.completed).length} active</span>
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckSquare className="h-4 w-4" />
            <span>{completedCount} done</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-tasks">
            All ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-tasks">
            Active ({tasks.filter((t) => !t.completed).length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed-tasks">
            Completed ({completedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-2">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <TaskItemSkeleton key={i} />
              ))}
            </>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title={
                activeTab === "all"
                  ? "No tasks yet"
                  : activeTab === "active"
                  ? "No active tasks"
                  : "No completed tasks"
              }
              description={
                activeTab === "all"
                  ? "Create your first task to start tracking work."
                  : activeTab === "active"
                  ? "All tasks are completed. Great job!"
                  : "Complete some tasks to see them here."
              }
              actionLabel={activeTab === "all" ? "Add Task" : undefined}
              onAction={activeTab === "all" ? onCreateTask : undefined}
            />
          ) : (
            filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={(completed) => onToggleTask(task, completed)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
