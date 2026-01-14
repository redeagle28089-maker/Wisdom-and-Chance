import { useState } from "react";
import { Plus, FolderKanban, Search } from "lucide-react";
import { ProjectCard, ProjectCardSkeleton } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, Task } from "@shared/schema";

interface ProjectsPageProps {
  projects: Project[];
  tasks: Task[];
  isLoading?: boolean;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}

export function ProjectsPage({
  projects,
  tasks,
  isLoading,
  onCreateProject,
  onEditProject,
  onDeleteProject,
}: ProjectsPageProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" data-testid="page-projects">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" data-testid="heading-projects">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and organize all your projects
          </p>
        </div>
        <Button onClick={onCreateProject} data-testid="button-create-project">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={search || statusFilter !== "all" ? "No matching projects" : "No projects yet"}
          description={
            search || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first project to get started organizing your tasks."
          }
          actionLabel={!search && statusFilter === "all" ? "Create Project" : undefined}
          onAction={!search && statusFilter === "all" ? onCreateProject : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              taskCount={tasks.filter((t) => t.projectId === project.id).length}
              onEdit={() => onEditProject(project)}
              onDelete={() => onDeleteProject(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
