export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskFilterStatus = "To Do" | "In Progress" | "Completed";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type TaskGuidance = {
  id: string;
  taskId: string;
  userId: string;
  summary: string;
  nextSteps: string[];
  risks: string[];
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
};
