import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { taskService } from "../services/task.service.js";

export const taskController = {
  createTask: async (req: Request, res: Response) => {
    const task = await taskService.createTask(req.user!.id, req.body);
    res.status(StatusCodes.CREATED).json({ task });
  },

  getTasks: async (req: Request, res: Response) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const tasks = await taskService.getTasks(req.user!.id, status);
    res.status(StatusCodes.OK).json({ tasks });
  },

  updateTask: async (req: Request, res: Response) => {
    const task = await taskService.updateTask(req.user!.id, String(req.params.taskId), req.body);
    res.status(StatusCodes.OK).json({ task });
  },

  deleteTask: async (req: Request, res: Response) => {
    await taskService.deleteTask(req.user!.id, String(req.params.taskId));
    res.status(StatusCodes.NO_CONTENT).send();
  },

  generateGuidance: async (req: Request, res: Response) => {
    const guidance = await taskService.generateGuidance(req.user!.id, String(req.params.taskId));
    res.status(StatusCodes.CREATED).json({ guidance });
  },
};
