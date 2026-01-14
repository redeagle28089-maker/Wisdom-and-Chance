import { MoreHorizontal, Trash2, Edit, GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { Task } from "@shared/schema";

interface TaskItemProps {
  task: Task;
  onToggle?: (completed: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const priorityColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  };

  const statusColors: Record<string, string> = {
    todo: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    "in-progress": "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    done: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  };

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-lg border bg-card transition-all"
      data-testid={`task-item-${task.id}`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      
      <Checkbox
        checked={task.completed}
        onCheckedChange={(checked) => onToggle?.(checked as boolean)}
        data-testid={`checkbox-task-${task.id}`}
      />
      
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            task.completed ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-xs capitalize ${statusColors[task.status] || statusColors.todo}`}
        >
          {task.status.replace("-", " ")}
        </Badge>
        <Badge
          variant="outline"
          className={`text-xs capitalize ${priorityColors[task.priority] || priorityColors.medium}`}
        >
          {task.priority}
        </Badge>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid={`button-task-menu-${task.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-task-${task.id}`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
            data-testid={`button-delete-task-${task.id}`}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TaskItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1">
        <Skeleton className="h-4 w-48 mb-1" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-5 w-14" />
    </div>
  );
}
