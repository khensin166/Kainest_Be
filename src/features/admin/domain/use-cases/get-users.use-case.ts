import { AdminRepository } from "../../data/admin.repository.js";

export class GetUsersUseCase {
  constructor(private repository: AdminRepository) {}

  async execute() {
    try {
      const users = await this.repository.getAllUsers();
      return { success: true, data: users };
    } catch (error: any) {
      console.error("[GetUsersUseCase Error]", error);
      return { success: false, message: error.message || "Failed to fetch users" };
    }
  }
}
