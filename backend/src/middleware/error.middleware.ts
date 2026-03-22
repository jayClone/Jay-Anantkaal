import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../errors/app-error.js";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  const message =
    process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error";

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message,
  });
};
