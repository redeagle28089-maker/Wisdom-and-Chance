import { useState, useEffect } from "react";
import { Switch, Route, useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { ProjectDialog } from "@/components/project-dialog";
import { TaskDialog } from "@/components/task-dialog";
import { DeleteDialog } from "@/components/delete-dialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardPage } from "@/pages/dashboard";
import { ProjectsPage } from "@/pages/projects";
import { ProjectDetailPage } from "@/pages/project-detail";
import { SettingsPage } from "@/pages/settings";
import NotFound from "@/pages/not-found";
import type { Project, Task, InsertProject, InsertTask } from "@shared/schema";

function AppContent() {
  const { toast } = useToast();
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const projectId = params?.id;

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const currentProject = projectId
    ? projects.find((p) => p.id === projectId) || null
    : null;

  const projectTasks = projectId
    ? tasks.filter((t) => t.projectId === projectId)
    : [];

  const createProjectMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setProjectDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertProject }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setProjectDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setDeleteDialogOpen(false);
      setDeletingProject(null);
      toast({ title: "Project deleted successfully" });
      if (projectId === deletedId) {
        navigate("/projects");
      }
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskDialogOpen(false);
      setEditingTask(null);
      toast({ title: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTask> }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskDialogOpen(false);
      setEditingTask(null);
      toast({ title: "Task updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setDeleteDialogOpen(false);
      setDeletingTask(null);
      toast({ title: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  const handleCreateProject = () => {
    setEditingProject(null);
    setProjectDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectDialogOpen(true);
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingProject(project);
    setDeletingTask(null);
    setDeleteDialogOpen(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setDeletingTask(task);
    setDeletingProject(null);
    setDeleteDialogOpen(true);
  };

  const handleToggleTask = (task: Task, completed: boolean) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { completed, status: completed ? "done" : "todo" },
    });
  };

  const handleProjectSubmit = (data: InsertProject) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const handleTaskSubmit = (data: InsertTask) => {
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingProject) {
      deleteProjectMutation.mutate(deletingProject.id);
    } else if (deletingTask) {
      deleteTaskMutation.mutate(deletingTask.id);
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar projects={projects} onCreateProject={handleCreateProject} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/">
                <DashboardPage
                  projects={projects}
                  tasks={tasks}
                  isLoading={projectsLoading || tasksLoading}
                  onCreateProject={handleCreateProject}
                />
              </Route>
              <Route path="/projects">
                <ProjectsPage
                  projects={projects}
                  tasks={tasks}
                  isLoading={projectsLoading}
                  onCreateProject={handleCreateProject}
                  onEditProject={handleEditProject}
                  onDeleteProject={handleDeleteProject}
                />
              </Route>
              <Route path="/projects/:id">
                <ProjectDetailPage
                  project={currentProject}
                  tasks={projectTasks}
                  isLoading={projectsLoading || tasksLoading}
                  onCreateTask={handleCreateTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onToggleTask={handleToggleTask}
                />
              </Route>
              <Route path="/settings">
                <SettingsPage />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>

      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        project={editingProject}
        onSubmit={handleProjectSubmit}
        isSubmitting={createProjectMutation.isPending || updateProjectMutation.isPending}
      />

      {projectId && (
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          task={editingTask}
          projectId={projectId}
          onSubmit={handleTaskSubmit}
          isSubmitting={createTaskMutation.isPending || updateTaskMutation.isPending}
        />
      )}

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={deletingProject ? "Delete Project" : "Delete Task"}
        description={
          deletingProject
            ? `Are you sure you want to delete "${deletingProject.name}"? This will also delete all tasks in this project. This action cannot be undone.`
            : deletingTask
            ? `Are you sure you want to delete "${deletingTask.title}"? This action cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteProjectMutation.isPending || deleteTaskMutation.isPending}
      />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="replit-app-theme">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
