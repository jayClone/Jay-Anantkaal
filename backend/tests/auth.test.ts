import request from "supertest";
import { jest } from "@jest/globals";
import { AppError } from "../src/errors/app-error.js";

const authServiceMock = {
  register: jest.fn(),
  login: jest.fn(),
  authenticateWithGoogle: jest.fn(),
  getProfile: jest.fn(),
};

await jest.unstable_mockModule("../src/services/auth.service.js", () => ({
  authService: authServiceMock,
}));

await jest.unstable_mockModule("../src/middleware/auth.middleware.js", () => ({
  authMiddleware: (
    req: { headers: { authorization?: string }; user?: { id: string; email: string; name: string } },
    res: { status: (code: number) => { json: (body: unknown) => unknown } },
    next: () => void,
  ) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    req.user = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    };

    next();
  },
}));

const { default: app } = await import("../src/index.js");

describe("Auth Endpoints", () => {
  const testUser = {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    name: "Test User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      authServiceMock.register.mockResolvedValue({
        token: "mock-token",
        user: testUser,
      });

      const res = await request(app).post("/api/auth/register").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token", "mock-token");
      expect(res.body.user).toHaveProperty("email", "test@example.com");
      expect(authServiceMock.register).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully and return a token", async () => {
      authServiceMock.login.mockResolvedValue({
        token: "login-token",
        user: testUser,
      });

      const res = await request(app).post("/api/auth/login").send({
        identifier: "test@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token", "login-token");
      expect(authServiceMock.login).toHaveBeenCalledWith({
        identifier: "test@example.com",
        password: "password123",
      });
    });

    it("should reject invalid credentials", async () => {
      authServiceMock.login.mockRejectedValue(
        new AppError("Invalid email/username or password", 401),
      );

      const res = await request(app).post("/api/auth/login").send({
        identifier: "test@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return the current user profile", async () => {
      authServiceMock.getProfile.mockResolvedValue(testUser);

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer mock-token");

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty("email", testUser.email);
      expect(res.body.user).toHaveProperty("username", testUser.username);
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/oauth/google", () => {
    it("should require an idToken", async () => {
      authServiceMock.authenticateWithGoogle.mockRejectedValue(
        new AppError("Google id token is required", 400),
      );

      const res = await request(app).post("/api/auth/oauth/google").send({});

      expect(res.status).toBe(400);
    });
  });
});
