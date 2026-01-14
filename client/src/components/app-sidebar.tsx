import { Home, FolderKanban, Settings, Plus, ChevronDown } from "lucide-react";
import { Link, useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Project } from "@shared/schema";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

interface AppSidebarProps {
  projects?: Project[];
  onCreateProject?: () => void;
}

export function AppSidebar({ projects = [], onCreateProject }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-sm">
            R
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Replit App</span>
            <span className="text-xs text-muted-foreground">Dashboard</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex items-center gap-1 cursor-pointer hover-elevate rounded-md px-2 py-1">
                  <span>Projects</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-2"
                onClick={onCreateProject}
                data-testid="button-create-project-sidebar"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No projects yet
                    </div>
                  ) : (
                    projects.slice(0, 5).map((project) => (
                      <SidebarMenuItem key={project.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === `/projects/${project.id}`}
                          data-testid={`nav-project-${project.id}`}
                        >
                          <Link href={`/projects/${project.id}`}>
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor:
                                  project.status === "active"
                                    ? "rgb(34 197 94)"
                                    : project.status === "completed"
                                    ? "rgb(59 130 246)"
                                    : "rgb(156 163 175)",
                              }}
                            />
                            <span className="truncate">{project.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                  {projects.length > 5 && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link href="/projects">
                          <span className="text-muted-foreground">
                            View all ({projects.length})
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
            U
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">User</span>
            <span className="text-xs text-muted-foreground">Free Plan</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
