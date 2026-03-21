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

const validatePassword = (password: string) => {
  if (password.trim().length < 8) {
    throw new AppError("Password must be at least 8 characters long", StatusCodes.BAD_REQUEST);
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
  register: async (input: RegisterInput) => {
    const email = normalizeEmail(input.email);
    const username = ensureUsername(input.username);
    const name = input.name?.trim() || input.username.trim();

    if (!name) {
      throw new AppError("Name is required", StatusCodes.BAD_REQUEST);
    }

    validatePassword(input.password);

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
        name,
        passwordHash,
        provider: AuthProvider.LOCAL,
        lastLoginAt: new Date(),
      },
    });

    return buildAuthResponse(user);
  },

  login: async (input: LoginInput) => {
    const identifier = input.identifier.trim();

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

    const passwordMatches = await hashUtils.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError("Invalid email/username or password", StatusCodes.UNAUTHORIZED);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return buildAuthResponse(updatedUser);
  },

  authenticateWithGoogle: async (input: GoogleAuthInput) => {
    if (!input.idToken?.trim()) {
      throw new AppError("Google id token is required", StatusCodes.BAD_REQUEST);
    }

    const profile = await fetchGoogleProfile(input.idToken);
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
            accessToken: input.idToken,
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
          accessToken: input.idToken,
          userId: userRecord.id,
        },
        create: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.sub,
          accessToken: input.idToken,
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

  getProfile: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    return sanitizeUser(user);
  },

  changePassword: async (userId: string, input: ChangePasswordInput) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }

    validatePassword(input.newPassword);

    if (user.passwordHash) {
      if (!input.currentPassword?.trim()) {
        throw new AppError("Current password is required", StatusCodes.BAD_REQUEST);
      }

      const passwordMatches = await hashUtils.compare(input.currentPassword, user.passwordHash);

      if (!passwordMatches) {
        throw new AppError("Current password is incorrect", StatusCodes.UNAUTHORIZED);
      }
    }

    if (input.currentPassword && input.currentPassword === input.newPassword) {
      throw new AppError(
        "New password must be different from your current password",
        StatusCodes.BAD_REQUEST,
      );
    }

    const passwordHash = await hashUtils.hash(input.newPassword);

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
