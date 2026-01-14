import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  getTasks(): Promise<Task[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  deleteTasksByProject(projectId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private tasks: Map<string, Task>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.tasks = new Map();

    this.seedData();
  }

  private seedData() {
    const project1: Project = {
      id: "proj-1",
      name: "Website Redesign",
      description: "Complete overhaul of the company website with modern design principles",
      status: "active",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    };
    const project2: Project = {
      id: "proj-2",
      name: "Mobile App Development",
      description: "Build a cross-platform mobile app for iOS and Android",
      status: "active",
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    };
    const project3: Project = {
      id: "proj-3",
      name: "API Integration",
      description: "Integrate third-party APIs for payment and analytics",
      status: "completed",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };

    this.projects.set(project1.id, project1);
    this.projects.set(project2.id, project2);
    this.projects.set(project3.id, project3);

    const tasks: Task[] = [
      {
        id: "task-1",
        projectId: "proj-1",
        title: "Design homepage mockups",
        description: "Create initial wireframes and high-fidelity mockups for the homepage",
        status: "done",
        priority: "high",
        completed: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-2",
        projectId: "proj-1",
        title: "Implement responsive navigation",
        description: "Build the main navigation component with mobile responsiveness",
        status: "in-progress",
        priority: "high",
        completed: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-3",
        projectId: "proj-1",
        title: "Set up CI/CD pipeline",
        description: "Configure automated testing and deployment workflows",
        status: "todo",
        priority: "medium",
        completed: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-4",
        projectId: "proj-2",
        title: "Set up React Native project",
        description: "Initialize the project with proper folder structure and dependencies",
        status: "done",
        priority: "high",
        completed: true,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-5",
        projectId: "proj-2",
        title: "Design authentication flow",
        description: "Create login, signup, and password reset screens",
        status: "in-progress",
        priority: "high",
        completed: false,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-6",
        projectId: "proj-3",
        title: "Stripe payment integration",
        description: "Implement payment processing with Stripe API",
        status: "done",
        priority: "high",
        completed: true,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      },
      {
        id: "task-7",
        projectId: "proj-3",
        title: "Analytics dashboard setup",
        description: "Integrate Google Analytics and create custom dashboards",
        status: "done",
        priority: "medium",
        completed: true,
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    ];

    tasks.forEach((task) => this.tasks.set(task.id, task));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      createdAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<InsertProject>
  ): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;

    const updated: Project = { ...existing, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter((task) => task.projectId === projectId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      createdAt: new Date(),
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(
    id: string,
    updates: Partial<InsertTask>
  ): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    const updated: Task = { ...existing, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async deleteTasksByProject(projectId: string): Promise<void> {
    const tasksToDelete = Array.from(this.tasks.values()).filter(
      (task) => task.projectId === projectId
    );
    tasksToDelete.forEach((task) => this.tasks.delete(task.id));
  }
}

export const storage = new MemStorage();
