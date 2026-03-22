import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { authService } from "../services/auth.service.js";

export const authController = {
  /**
   * Register a new local user account and return a signed JWT payload.
   *
   * @async
   * @function register
   * @param {Request} req - Express request containing registration fields.
   * @param {Response} res - Express response used to return the created auth payload.
   * @returns {Promise<void>} Sends `{ token, user }` with HTTP 201.
   */
  register: async (req: Request, res: Response) => {
    const payload = await authService.register(req.body);
    res.status(StatusCodes.CREATED).json(payload);
  },

  /**
   * Authenticate a local user by username/email and password.
   *
   * @async
   * @function login
   * @param {Request} req - Express request containing login credentials.
   * @param {Response} res - Express response used to return the auth payload.
   * @returns {Promise<void>} Sends `{ token, user }` with HTTP 200.
   */
  login: async (req: Request, res: Response) => {
    const payload = await authService.login(req.body);
    res.status(StatusCodes.OK).json(payload);
  },

  /**
   * Exchange a Google ID token for an application JWT and user profile.
   *
   * @async
   * @function google
   * @param {Request} req - Express request containing the Google `idToken`.
   * @param {Response} res - Express response used to return the auth payload.
   * @returns {Promise<void>} Sends `{ token, user }` with HTTP 200.
   */
  google: async (req: Request, res: Response) => {
    const payload = await authService.authenticateWithGoogle(req.body);
    res.status(StatusCodes.OK).json(payload);
  },

  /**
   * Return the authenticated user's current profile.
   *
   * @async
   * @function me
   * @param {Request} req - Authenticated Express request with `req.user`.
   * @param {Response} res - Express response used to return the current user.
   * @returns {Promise<void>} Sends `{ user }` with HTTP 200.
   */
  me: async (req: Request, res: Response) => {
    const user = await authService.getProfile(req.user!.id);
    res.status(StatusCodes.OK).json({ user });
  },

  /**
   * Create or update the authenticated user's local password.
   *
   * @async
   * @function changePassword
   * @param {Request} req - Authenticated Express request with password input.
   * @param {Response} res - Express response used to return the success message.
   * @returns {Promise<void>} Sends `{ message }` with HTTP 200.
   */
  changePassword: async (req: Request, res: Response) => {
    const payload = await authService.changePassword(req.user!.id, req.body);
    res.status(StatusCodes.OK).json(payload);
  },
};
