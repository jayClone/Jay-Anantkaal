import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  name: string;
};

export const tokenUtils = {
  sign: (payload: AuthTokenPayload) =>
    jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    } as SignOptions),
  verify: (token: string) => jwt.verify(token, env.jwtSecret) as AuthTokenPayload,
};
