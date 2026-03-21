import bcrypt from "bcryptjs";

export const hashUtils = {
  hash: async (value: string) => bcrypt.hash(value, 12),
  compare: async (value: string, hashedValue: string) => bcrypt.compare(value, hashedValue),
};
