import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../errors/app-error.js";
import { tokenUtils } from "../utils/token.js";

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new AppError("Authorization token is required", StatusCodes.UNAUTHORIZED));
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    const payload = tokenUtils.verify(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };

    return next();
  } catch {
    return next(new AppError("Invalid or expired token", StatusCodes.UNAUTHORIZED));
  }
};
