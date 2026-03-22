import { AuthProvider } from "@prisma/client";
import type { User } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { hashUtils } from "../utils/hash.js";
import { tokenUtils } from "../utils/token.js";

type RegisterInput = {
  username: string;
  name?: string;
  email: string;
  password: string;
};

type LoginInput = {
  identifier: string;
  password: string;
};

type GoogleAuthInput = {
  idToken: string;
};

type ChangePasswordInput = {
  currentPassword?: string;
  newPassword: string;
};

type GoogleTokenInfo = {
  sub: string;
  email: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  aud?: string;
};

const sanitizeUser = (user: User) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
  provider: user.provider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildAuthResponse = (user: User) => ({
  token: tokenUtils.sign({
    sub: user.id,
    email: user.email,
    name: user.name,
  }),
  user: sanitizeUser(user),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase();

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, StatusCodes.BAD_REQUEST);
  }

  return value;
};

const ensureUsername = (username: string) => {
  const normalized = normalizeUsername(username);

  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) {
    throw new AppError(
      "Username must be 3-30 characters and contain only lowercase letters, numbers, or underscores",
      StatusCodes.BAD_REQUEST,
    );
  }

  return normalized;
};

const validateName = (name: string) => {
  if (!name.trim()) {
    throw new AppError("Name is required", StatusCodes.BAD_REQUEST);
  }

  if (name.trim().length > 100) {
    throw new AppError("Name must be 100 characters or fewer", StatusCodes.BAD_REQUEST);
  }
};

const validateEmail = (email: string) => {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw new AppError("Email is required", StatusCodes.BAD_REQUEST);
  }

  if (normalized.length > 255) {
    throw new AppError("Email must be 255 characters or fewer", StatusCodes.BAD_REQUEST);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalized)) {
    throw new AppError("Email must be a valid email address", StatusCodes.BAD_REQUEST);
  }

  return normalized;
};

const validatePassword = (password: string) => {
  if (password.trim().length < 8) {
    throw new AppError("Password must be at least 8 characters long", StatusCodes.BAD_REQUEST);
  }

  if (password.length > 128) {
    throw new AppError("Password must be 128 characters or fewer", StatusCodes.BAD_REQUEST);
  }
};

const findUniqueUsername = async (seed: string) => {
  const cleanedSeed =
    seed
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "user";

  const base = ensureUsername(cleanedSeed);
  let candidate = base;
  let suffix = 1;

  for (;;) {
    const existingUser = await prisma.user.findUnique({
      where: { username: candidate },
    });

    if (!existingUser) {
      return candidate;
    }

    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
};

const fetchGoogleProfile = async (idToken: string): Promise<GoogleTokenInfo> => {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!response.ok) {
    throw new AppError("Unable to verify Google account", StatusCodes.UNAUTHORIZED);
  }

  const profile = (await response.json()) as GoogleTokenInfo;

  if (!profile.email || profile.email_verified !== "true") {
    throw new AppError("Google account must have a verified email", StatusCodes.UNAUTHORIZED);
  }

  if (env.googleClientId && profile.aud !== env.googleClientId) {
    throw new AppError("Google token audience mismatch", StatusCodes.UNAUTHORIZED);
  }

  return profile;
};

export const authService = {
  /**
   * Create a new local account after validating payload types, field constraints,
   * uniqueness rules, and the local password policy.
   *
   * @async
   * @function register
   * @param {RegisterInput} input - Registration payload from the client.
   * @returns {Promise<{token: string, user: ReturnType<typeof sanitizeUser>}>} Auth payload for the new user.
   * @throws {AppError} Throws `400` for invalid field shapes or values and `409` for duplicate email/username.
   */
  register: async (input: RegisterInput) => {
    const usernameInput = requireString(input.username, "Username");
    const email = validateEmail(requireString(input.email, "Email"));
    const username = ensureUsername(usernameInput);
    const resolvedName =
      input.name === undefined ? usernameInput.trim() : requireString(input.name, "Name").trim() || usernameInput.trim();

    validateName(resolvedName);
    validatePassword(requireString(input.password, "Password"));

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({
        where: { email },
      }),
      prisma.user.findUnique({
        where: { username },
      }),
    ]);

    if (existingEmail) {
      throw new AppError("User already exists with this email", StatusCodes.CONFLICT);
    }

    if (existingUsername) {
      throw new AppError("Username is already taken", StatusCodes.CONFLICT);
    }

    const passwordHash = await hashUtils.hash(input.password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        name: resolvedName,
        passwordHash,
        provider: AuthProvider.LOCAL,
        lastLoginAt: new Date(),
      },
    });

    return buildAuthResponse(user);
  },

  /**
   * Authenticate a local user with username/email and password after validating
   * the credential payload shape.
   *
   * @async
   * @function login
   * @param {LoginInput} input - Login credentials from the client.
   * @returns {Promise<{token: string, user: ReturnType<typeof sanitizeUser>}>} Auth payload for the user.
   * @throws {AppError} Throws `400` for malformed input and `401` for invalid credentials.
   */
  login: async (input: LoginInput) => {
    const identifier = requireString(input.identifier, "Email or username").trim();
    const password = requireString(input.password, "Password");

    if (!identifier) {
      throw new AppError("Email or username is required", StatusCodes.BAD_REQUEST);
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizeEmail(identifier) },
          { username: normalizeUsername(identifier) },
        ],
      },
    });

    if (!user?.passwordHash) {
      throw new AppError("Invalid email/username or password", StatusCodes.UNAUTHORIZED);
    }

    const passwordMatches = await hashUtils.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError("Invalid email/username or password", StatusCodes.UNAUTHORIZED);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return buildAuthResponse(updatedUser);
  },

  /**
   * Verify a Google ID token, then link or create a user record before returning
   * an application JWT.
   *
   * @async
   * @function authenticateWithGoogle
   * @param {GoogleAuthInput} input - Payload containing the Google `idToken`.
   * @returns {Promise<{token: string, user: ReturnType<typeof sanitizeUser>}>} Auth payload for the resolved user.
   * @throws {AppError} Throws `400` for malformed input and `401` when Google token verification fails.
   */
  authenticateWithGoogle: async (input: GoogleAuthInput) => {
    const idToken = requireString(input.idToken, "Google id token").trim();

    if (!idToken) {
      throw new AppError("Google id token is required", StatusCodes.BAD_REQUEST);
    }

    const profile = await fetchGoogleProfile(idToken);
    const email = normalizeEmail(profile.email);

    const user = await prisma.$transaction(async (tx) => {
      const existingOauth = await tx.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: profile.sub,
          },
        },
        include: {
          user: true,
        },
      });

      if (existingOauth) {
        await tx.oAuthAccount.update({
          where: { id: existingOauth.id },
          data: {
            accessToken: idToken,
          },
        });

        return tx.user.update({
          where: { id: existingOauth.user.id },
          data: {
            name: profile.name ?? existingOauth.user.name,
            avatarUrl: profile.picture ?? existingOauth.user.avatarUrl,
            lastLoginAt: new Date(),
          },
        });
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
      });

      if (existingUser?.provider === AuthProvider.LOCAL && !existingUser.passwordHash) {
        throw new AppError("This account is incomplete and cannot use Google sign-in yet");
      }

      const userRecord =
        existingUser ??
        (await tx.user.create({
          data: {
            username: await findUniqueUsername(profile.email.split("@")[0] || "google_user"),
            email,
            name: profile.name?.trim() || email.split("@")[0] || "Google User",
            provider: AuthProvider.GOOGLE,
            lastLoginAt: new Date(),
            ...(profile.picture ? { avatarUrl: profile.picture } : {}),
          },
        }));

      await tx.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: profile.sub,
          },
        },
        update: {
          accessToken: idToken,
          userId: userRecord.id,
        },
        create: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.sub,
          accessToken: idToken,
          userId: userRecord.id,
        },
      });

      return tx.user.update({
        where: { id: userRecord.id },
        data: {
          avatarUrl: profile.picture ?? userRecord.avatarUrl,
          name: profile.name ?? userRecord.name,
          lastLoginAt: new Date(),
          provider: existingUser?.provider ?? AuthProvider.GOOGLE,
        },
      });
    });

    return buildAuthResponse(user);
  },

  /**
   * Fetch the sanitized profile for the authenticated user.
   *
   * @async
   * @function getProfile
   * @param {string} userId - Unique identifier of the authenticated user.
   * @returns {Promise<ReturnType<typeof sanitizeUser>>} Sanitized user profile.
   */
  getProfile: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    return sanitizeUser(user);
  },

  /**
   * Create or update the caller's local password.
   *
   * For OAuth users without a stored password hash, `currentPassword` is optional and
   * this operation behaves like first-time password creation. For users who already
   * have a local password, the current password must be supplied and verified before
   * the new password hash is persisted.
   *
   * @async
   * @function changePassword
   * @param {string} userId - Unique identifier of the authenticated user.
   * @param {ChangePasswordInput} input - Password update payload.
   * @returns {Promise<{message: string}>} Success message describing the outcome.
   * @throws {AppError} Throws `400` for invalid payloads, `401` for incorrect current passwords, and `404` when the user no longer exists.
   */
  changePassword: async (userId: string, input: ChangePasswordInput) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    const newPassword = requireString(input.newPassword, "New password");
    validatePassword(newPassword);

    if (user.passwordHash) {
      const currentPassword = requireString(input.currentPassword, "Current password").trim();

      if (!currentPassword) {
        throw new AppError("Current password is required", StatusCodes.BAD_REQUEST);
      }

      const passwordMatches = await hashUtils.compare(currentPassword, user.passwordHash);

      if (!passwordMatches) {
        throw new AppError("Current password is incorrect", StatusCodes.UNAUTHORIZED);
      }
    }

    if (typeof input.currentPassword === "string" && input.currentPassword === newPassword) {
      throw new AppError(
        "New password must be different from your current password",
        StatusCodes.BAD_REQUEST,
      );
    }

    const passwordHash = await hashUtils.hash(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    return {
      message: user.passwordHash
        ? "Password updated successfully"
        : "Password created successfully for your account",
    };
  },
};
