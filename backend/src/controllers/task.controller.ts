import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { taskService } from "../services/task.service.js";

export const taskController = {
  /**
   * Create a new task for the authenticated user.
   *
   * @async
   * @function createTask
   * @param {Request} req - Authenticated Express request containing task input.
   * @param {Response} res - Express response used to return the created task.
   * @returns {Promise<void>} Sends `{ task }` with HTTP 201.
   */
  createTask: async (req: Request, res: Response) => {
    const task = await taskService.createTask(req.user!.id, req.body);
    res.status(StatusCodes.CREATED).json({ task });
  },

  /**
   * Return all tasks for the authenticated user, optionally filtered by status.
   *
   * @async
   * @function getTasks
   * @param {Request} req - Authenticated Express request with optional `status` query param.
   * @param {Response} res - Express response used to return the task collection.
   * @returns {Promise<void>} Sends `{ tasks }` with HTTP 200.
   */
  getTasks: async (req: Request, res: Response) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const tasks = await taskService.getTasks(req.user!.id, status);
    res.status(StatusCodes.OK).json({ tasks });
  },

  /**
   * Update an existing task owned by the authenticated user.
   *
   * @async
   * @function updateTask
   * @param {Request} req - Authenticated Express request with `taskId` and update fields.
   * @param {Response} res - Express response used to return the updated task.
   * @returns {Promise<void>} Sends `{ task }` with HTTP 200.
   */
  updateTask: async (req: Request, res: Response) => {
    const task = await taskService.updateTask(req.user!.id, String(req.params.taskId), req.body);
    res.status(StatusCodes.OK).json({ task });
  },

  /**
   * Delete a task owned by the authenticated user.
   *
   * @async
   * @function deleteTask
   * @param {Request} req - Authenticated Express request with `taskId`.
   * @param {Response} res - Express response used to confirm deletion.
   * @returns {Promise<void>} Sends HTTP 204 on success.
   */
  deleteTask: async (req: Request, res: Response) => {
    await taskService.deleteTask(req.user!.id, String(req.params.taskId));
    res.status(StatusCodes.NO_CONTENT).send();
  },

  /**
   * Generate and persist guidance for a specific task.
   *
   * @async
   * @function generateGuidance
   * @param {Request} req - Authenticated Express request with `taskId`.
   * @param {Response} res - Express response used to return the stored guidance.
   * @returns {Promise<void>} Sends `{ guidance }` with HTTP 201.
   */
  generateGuidance: async (req: Request, res: Response) => {
    const guidance = await taskService.generateGuidance(req.user!.id, String(req.params.taskId));
    res.status(StatusCodes.CREATED).json({ guidance });
  },
};
