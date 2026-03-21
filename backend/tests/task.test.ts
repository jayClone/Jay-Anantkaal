import request from "supertest";
import { jest } from "@jest/globals";
import { AppError } from "../src/errors/app-error.js";

const taskServiceMock = {
  createTask: jest.fn(),
  getTasks: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  generateGuidance: jest.fn(),
};

await jest.unstable_mockModule("../src/services/task.service.js", () => ({
  taskService: taskServiceMock,
}));

await jest.unstable_mockModule("../src/middleware/auth.middleware.js", () => ({
  authMiddleware: (
    req: { user?: { id: string; email: string; name: string } },
    _res: unknown,
    next: () => void,
  ) => {
    req.user = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    };
    next();
  },
}));

const { default: app } = await import("../src/index.js");

describe("Task Endpoints", () => {
  const task = {
    id: "task-1",
    title: "Complete integration testing",
    description: "Write supertest cases for endpoints",
    priority: "HIGH",
    status: "TODO",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/tasks", () => {
    it("should create a new task", async () => {
      taskServiceMock.createTask.mockResolvedValue(task);

      const res = await request(app).post("/api/tasks").send({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
      });

      expect(res.status).toBe(201);
      expect(res.body.task).toHaveProperty("id", "task-1");
      expect(res.body.task.title).toBe(task.title);
    });

    it("should fail if title is missing", async () => {
      taskServiceMock.createTask.mockRejectedValue(new AppError("Task title is required", 400));

      const res = await request(app).post("/api/tasks").send({
        description: "Missing title",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/tasks", () => {
    it("should retrieve a list of tasks", async () => {
      taskServiceMock.getTasks.mockResolvedValue([task]);

      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(res.body.tasks).toHaveLength(1);
    });

    it("should filter tasks by status", async () => {
      taskServiceMock.getTasks.mockResolvedValue([task]);

      const res = await request(app).get("/api/tasks?status=To Do");

      expect(res.status).toBe(200);
      expect(taskServiceMock.getTasks).toHaveBeenCalledWith("user-1", "To Do");
    });
  });

  describe("PUT /api/tasks/:taskId", () => {
    it("should update an existing task", async () => {
      taskServiceMock.updateTask.mockResolvedValue({
        ...task,
        title: "Complete integration testing - Updated",
        status: "IN_PROGRESS",
      });

      const res = await request(app).put("/api/tasks/task-1").send({
        title: "Complete integration testing - Updated",
        status: "IN_PROGRESS",
      });

      expect(res.status).toBe(200);
      expect(res.body.task.title).toBe("Complete integration testing - Updated");
      expect(res.body.task.status).toBe("IN_PROGRESS");
    });
  });

  describe("PATCH /api/tasks/:taskId", () => {
    it("should dynamically patch an existing task", async () => {
      taskServiceMock.updateTask.mockResolvedValue({
        ...task,
        priority: "LOW",
      });

      const res = await request(app).patch("/api/tasks/task-1").send({
        priority: "LOW",
      });

      expect(res.status).toBe(200);
      expect(res.body.task.priority).toBe("LOW");
    });
  });

  describe("DELETE /api/tasks/:taskId", () => {
    it("should delete the task successfully", async () => {
      taskServiceMock.deleteTask.mockResolvedValue(undefined);

      const res = await request(app).delete("/api/tasks/task-1");

      expect(res.status).toBe(204);
    });

    it("should return 404 for a deleted task", async () => {
      taskServiceMock.deleteTask.mockRejectedValue(new AppError("Task not found", 404));

      const res = await request(app).delete("/api/tasks/task-1");

      expect(res.status).toBe(404);
    });
  });

  // Intentionally skipping POST /api/tasks/:taskId/guidance
  // so tests do not consume Gemini quota or hit model rate limits.
});
