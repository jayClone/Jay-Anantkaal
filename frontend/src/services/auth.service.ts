import api from "./api";
import type { AuthResponse } from "../types";

type RegisterInput = {
  username: string;
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  identifier: string;
  password: string;
};

type GoogleLoginInput = {
  idToken: string;
};

export const authService = {
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/register", input);
    return data;
  },

  login: async (input: LoginInput): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/login", input);
    return data;
  },

  googleLogin: async (input: GoogleLoginInput): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/oauth/google", input);
    return data;
  },

  changePassword: async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>("/auth/change-password", input);
    return data;
  },

  getProfile: async () => {
    const { data } = await api.get<{ user: AuthResponse["user"] }>("/auth/me");
    return data.user;
  },
};
