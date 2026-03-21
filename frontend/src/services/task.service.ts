import api from "./api";
import type { CreateTaskInput, Task, TaskFilterStatus, TaskGuidance, UpdateTaskInput } from "../types";

export const taskService = {
  getTasks: async (status?: TaskFilterStatus): Promise<Task[]> => {
    const params = status ? { status } : undefined;
    const { data } = await api.get<{ tasks: Task[] }>("/tasks", { params });
    return data.tasks;
  },

  createTask: async (input: CreateTaskInput): Promise<Task> => {
    const { data } = await api.post<{ task: Task }>("/tasks", input);
    return data.task;
  },

  updateTask: async (taskId: string, input: UpdateTaskInput): Promise<Task> => {
    const { data } = await api.put<{ task: Task }>(`/tasks/${taskId}`, input);
    return data.task;
  },

  patchTask: async (taskId: string, input: UpdateTaskInput): Promise<Task> => {
    const { data } = await api.patch<{ task: Task }>(`/tasks/${taskId}`, input);
    return data.task;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    await api.delete(`/tasks/${taskId}`);
  },

  generateGuidance: async (taskId: string): Promise<TaskGuidance> => {
    const { data } = await api.post<{ guidance: TaskGuidance }>(`/tasks/${taskId}/guidance`);
    return data.guidance;
  },
};
