import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { authService } from "../services/auth.service.js";

export const authController = {
  register: async (req: Request, res: Response) => {
    const payload = await authService.register(req.body);
    res.status(StatusCodes.CREATED).json(payload);
  },

  login: async (req: Request, res: Response) => {
    const payload = await authService.login(req.body);
    res.status(StatusCodes.OK).json(payload);
  },

  google: async (req: Request, res: Response) => {
    const payload = await authService.authenticateWithGoogle(req.body);
    res.status(StatusCodes.OK).json(payload);
  },

  me: async (req: Request, res: Response) => {
    const user = await authService.getProfile(req.user!.id);
    res.status(StatusCodes.OK).json({ user });
  },

  changePassword: async (req: Request, res: Response) => {
    const payload = await authService.changePassword(req.user!.id, req.body);
    res.status(StatusCodes.OK).json(payload);
  },
};
