import { TaskPriority, TaskStatus } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

type CreateTaskInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  status?: TaskStatus;
};

type UpdateTaskInput = {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
};

type GuidanceResult = {
  summary: string;
  nextSteps: string[];
  risks: string[];
  generatedBy: string;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
};

const requireOptionalString = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, StatusCodes.BAD_REQUEST);
  }

  return value;
};

const taskStatusMap: Record<string, TaskStatus> = {
  todo: TaskStatus.TODO,
  "to do": TaskStatus.TODO,
  to_do: TaskStatus.TODO,
  inprogress: TaskStatus.IN_PROGRESS,
  "in progress": TaskStatus.IN_PROGRESS,
  in_progress: TaskStatus.IN_PROGRESS,
  completed: TaskStatus.DONE,
  complete: TaskStatus.DONE,
  done: TaskStatus.DONE,
};

const parseDueDate = (dueDate?: string | null) => {
  if (dueDate === undefined) {
    return undefined;
  }

  if (dueDate === null || dueDate === "") {
    return null;
  }

  const parsed = new Date(dueDate);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Due date must be a valid ISO date", StatusCodes.BAD_REQUEST);
  }

  return parsed;
};

const validateTaskTitle = (title: string) => {
  if (!title.trim()) {
    throw new AppError("Task title is required", StatusCodes.BAD_REQUEST);
  }

  if (title.trim().length > 150) {
    throw new AppError("Task title must be 150 characters or fewer", StatusCodes.BAD_REQUEST);
  }
};

const validateTaskDescription = (description?: string) => {
  if (description !== undefined && description.trim().length > 2000) {
    throw new AppError("Task description must be 2000 characters or fewer", StatusCodes.BAD_REQUEST);
  }
};

const normalizeTaskStatus = (status?: string) => {
  if (!status) {
    return undefined;
  }

  const normalized = status.trim().toLowerCase();

  if (normalized in taskStatusMap) {
    return taskStatusMap[normalized];
  }

  if (Object.values(TaskStatus).includes(status as TaskStatus)) {
    return status as TaskStatus;
  }

  throw new AppError(
    "Invalid status filter. Use To Do, In Progress, or Completed",
    StatusCodes.BAD_REQUEST,
  );
};

const buildFallbackGuidance = (task: {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
}): GuidanceResult => {
  const dueDateText = task.dueDate
    ? `Target completion date is ${task.dueDate.toISOString().slice(0, 10)}.`
    : "No deadline is set yet, so define one before execution drifts.";

  return {
    summary: `Focus on turning "${task.title}" into the next visible deliverable. ${dueDateText}`,
    nextSteps: [
      "Break the task into 2-4 concrete deliverables with clear outputs.",
      "Start with the highest-risk unknown so blockers surface early.",
      "Define a quick success check that proves the task is actually done.",
    ],
    risks: [
      task.priority === TaskPriority.HIGH
        ? "High-priority work can sprawl fast if the scope is not constrained."
        : "The task may feel vague if the next deliverable is not explicit.",
      task.description
        ? "Make sure the description reflects real acceptance criteria, not just intent."
        : "Missing task details can cause rework when implementation starts.",
    ],
    generatedBy: "fallback-strategy",
  };
};

const buildGeminiPrompt = (task: {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
}) => `
You are a task execution coach. Give tailored, concrete guidance for this exact task.
Respond with strict JSON only. No markdown, no prose outside JSON.
{
  "summary": "short paragraph",
  "nextSteps": ["3 concise steps"],
  "risks": ["2 concise risks"]
}

Task title: ${task.title}
Task description: ${task.description ?? "No description"}
Priority: ${task.priority}
Status: ${task.status}
Due date: ${task.dueDate?.toISOString() ?? "Not set"}

Rules:
- Make the advice specific to the task title and description.
- Avoid generic filler like "break it down" unless tied to the task context.
- Mention concrete learning or execution actions when the task is about learning.
`;

const extractGeminiText = (payload: GeminiGenerateResponse) =>
  payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

const extractJsonPayload = (text: string) => {
  const fencedMatch =
    text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
};

const parseGuidanceJson = (text: string, generatedBy: string): GuidanceResult | null => {
  try {
    const parsed = JSON.parse(extractJsonPayload(text)) as {
      summary?: string;
      nextSteps?: string[];
      risks?: string[];
    };

    if (!parsed.summary || !Array.isArray(parsed.nextSteps) || !Array.isArray(parsed.risks)) {
      return null;
    }

    return {
      summary: parsed.summary,
      nextSteps: parsed.nextSteps,
      risks: parsed.risks,
      generatedBy,
    };
  } catch {
    return null;
  }
};

const logGeminiIssue = (message: string, details?: unknown) => {
  console.warn(`[gemini] ${message}`, details ?? "");
};

const generateGuidanceWithGemini = async (task: {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
}) => {
  if (!env.geminiApiKey) {
    logGeminiIssue("Missing GEMINI_API_KEY. Falling back to deterministic guidance.");
    return null;
  }

  // Try the preferred model first, then step down only when Gemini rejects the request or quota is exhausted.
  const models = [env.geminiPrimaryModel, ...env.geminiFallbackModels].filter(
    (value, index, allValues) => value && allValues.indexOf(value) === index,
  );

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildGeminiPrompt(task),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
        }),
      },
    );

    const payload = (await response.json()) as GeminiGenerateResponse;
    const isRateLimited =
      response.status === StatusCodes.TOO_MANY_REQUESTS ||
      payload.error?.status === "RESOURCE_EXHAUSTED";

    if (!response.ok) {
      logGeminiIssue(`Model ${model} returned ${response.status}`, payload.error?.message ?? payload);

      if (isRateLimited) {
        continue;
      }

      return null;
    }

    const text = extractGeminiText(payload);

    if (!text) {
      logGeminiIssue(`Model ${model} returned no text content`, payload);
      continue;
    }

    const parsed = parseGuidanceJson(text, `gemini:${model}`);

    if (parsed) {
      return parsed;
    }

    logGeminiIssue(`Model ${model} returned unparseable JSON`, text);
  }

  return null;
};

export const taskService = {
  /**
   * Create a task for the authenticated user after validating title, optional
   * description, and due date shape.
   *
   * @async
   * @function createTask
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {CreateTaskInput} input - Task creation payload.
   * @returns {Promise<object>} Newly created task including the latest guidance relation.
   * @throws {AppError} Throws `400` for malformed fields such as empty titles or invalid dates.
   */
  createTask: async (userId: string, input: CreateTaskInput) => {
    const title = requireOptionalString(input.title, "Task title");
    const description = requireOptionalString(input.description, "Task description");

    if (title === undefined) {
      throw new AppError("Task title is required", StatusCodes.BAD_REQUEST);
    }

    validateTaskTitle(title);
    validateTaskDescription(description);

    const dueDate = parseDueDate(input.dueDate);

    return prisma.task.create({
      data: {
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: input.priority ?? TaskPriority.MEDIUM,
        status: input.status ?? TaskStatus.TODO,
        ...(dueDate !== undefined ? { dueDate } : {}),
      },
      include: {
        guidances: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  },

  /**
   * Retrieve the authenticated user's tasks, optionally filtered by status.
   *
   * @async
   * @function getTasks
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string | undefined} status - Optional human-readable status filter.
   * @returns {Promise<object[]>} Task list ordered by newest first.
   * @throws {AppError} Throws `400` when the provided status filter cannot be normalized.
   */
  getTasks: async (userId: string, status?: string) => {
    const normalizedStatus = normalizeTaskStatus(status);
    const where: { userId: string; status?: TaskStatus } = { userId };

    if (normalizedStatus) {
      where.status = normalizedStatus;
    }

    return prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        guidances: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  },

  /**
   * Update a task owned by the authenticated user after validating the provided
   * fields and verifying ownership.
   *
   * @async
   * @function updateTask
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} taskId - Unique identifier of the target task.
   * @param {UpdateTaskInput} input - Task update payload.
   * @returns {Promise<object>} Updated task including the latest guidance relation.
   * @throws {AppError} Throws `400` for invalid field values and `404` when the task is not owned by the caller.
   */
  updateTask: async (userId: string, taskId: string, input: UpdateTaskInput) => {
    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new AppError("Task not found", StatusCodes.NOT_FOUND);
    }

    if (input.title !== undefined) {
      validateTaskTitle(requireOptionalString(input.title, "Task title")!);
    }

    const description = requireOptionalString(input.description, "Task description");
    validateTaskDescription(description);

    const dueDate = parseDueDate(input.dueDate);
    const data: {
      title?: string;
      description?: string | null;
      priority?: TaskPriority;
      status?: TaskStatus;
      dueDate?: Date | null;
    } = {};

    if (input.title !== undefined) {
      data.title = input.title.trim();
    }

    if (input.description !== undefined) {
      data.description = description?.trim() || null;
    }

    if (input.priority !== undefined) {
      data.priority = input.priority;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (dueDate !== undefined) {
      data.dueDate = dueDate;
    }

    return prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        guidances: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  },

  /**
   * Delete a task owned by the authenticated user.
   *
   * @async
   * @function deleteTask
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} taskId - Unique identifier of the target task.
   * @returns {Promise<void>} Resolves when the task has been removed.
   * @throws {AppError} Throws `404` when the task does not exist for the caller.
   */
  deleteTask: async (userId: string, taskId: string) => {
    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new AppError("Task not found", StatusCodes.NOT_FOUND);
    }

    await prisma.task.delete({
      where: { id: taskId },
    });
  },

  /**
   * Generate and persist task guidance for the authenticated user.
   *
   * Gemini is attempted first, then configured fallback models, and finally a deterministic
   * local strategy when remote generation is unavailable.
   *
   * @async
   * @function generateGuidance
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {string} taskId - Unique identifier of the target task.
   * @returns {Promise<object>} Stored guidance record for the task.
   * @throws {AppError} Throws `404` when the task does not exist for the caller.
   */
  generateGuidance: async (userId: string, taskId: string) => {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new AppError("Task not found", StatusCodes.NOT_FOUND);
    }

    const aiGuidance = (await generateGuidanceWithGemini(task)) ?? buildFallbackGuidance(task);

    return prisma.taskGuidance.create({
      data: {
        userId,
        taskId,
        summary: aiGuidance.summary,
        nextSteps: aiGuidance.nextSteps,
        risks: aiGuidance.risks,
        generatedBy: aiGuidance.generatedBy,
      },
    });
  },
};
