import type { Request, Response, NextFunction, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyPrefix: string;
  keySelector?: (req: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const defaultKeySelector = (req: Request) => req.user?.id ?? req.ip ?? "anonymous";

export const createRateLimitMiddleware = ({
  windowMs,
  maxRequests,
  message,
  keyPrefix,
  keySelector = defaultKeySelector,
}: RateLimitOptions): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${keyPrefix}:${keySelector(req)}`;
    const current = rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      res.setHeader("RateLimit-Limit", maxRequests.toString());
      res.setHeader("RateLimit-Remaining", Math.max(maxRequests - 1, 0).toString());
      res.setHeader("RateLimit-Reset", Math.ceil((now + windowMs) / 1000).toString());
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.max(Math.ceil((current.resetAt - now) / 1000), 1);

      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.setHeader("RateLimit-Limit", maxRequests.toString());
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", Math.ceil(current.resetAt / 1000).toString());

      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        message,
      });
    }

    current.count += 1;
    rateLimitStore.set(key, current);

    res.setHeader("RateLimit-Limit", maxRequests.toString());
    res.setHeader("RateLimit-Remaining", Math.max(maxRequests - current.count, 0).toString());
    res.setHeader("RateLimit-Reset", Math.ceil(current.resetAt / 1000).toString());

    return next();
  };
};
