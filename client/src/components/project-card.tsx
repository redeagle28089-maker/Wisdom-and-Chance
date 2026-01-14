import { MoreHorizontal, Trash2, Edit, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@shared/schema";

interface ProjectCardProps {
  project: Project;
  taskCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, taskCount = 0, onEdit, onDelete }: ProjectCardProps) {
  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    archived: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
  };

  return (
    <Card className="group transition-all" data-testid={`card-project-${project.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1 min-w-0 flex-1">
          <CardTitle className="text-base font-semibold truncate">
            <Link href={`/projects/${project.id}`} className="hover:underline">
              {project.name}
            </Link>
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-xs capitalize ${statusColors[project.status] || statusColors.active}`}
          >
            {project.status}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`button-project-menu-${project.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/projects/${project.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-project-${project.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
              data-testid={`button-delete-project-${project.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {project.description || "No description"}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
          <span>
            {project.createdAt
              ? new Date(project.createdAt).toLocaleDateString()
              : "Recently created"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
