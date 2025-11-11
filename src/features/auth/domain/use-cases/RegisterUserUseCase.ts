// RegisterUserUseCase.ts
import { userRepository } from "../../data/UserRepository.js";
import bcrypt from "bcryptjs";

export const registerUserUseCase = async (data: {
  email: string;
  password: string;
  name?: string;
}) => {
  const existing = await userRepository.findByEmail(data.email);
  if (existing) return { success: false, message: "Email already registered" };

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await userRepository.create({
    email: data.email,
    password: hashedPassword,
    name: data.name,
  });
  return { success: true, user };
};
