import { AdminRepository } from "../../data/admin.repository.js";

interface UpdateUserAccessParams {
  userId: string;
  role?: string;
  banned?: boolean;
  permissions?: string[];
}

export class UpdateUserAccessUseCase {
  constructor(private repository: AdminRepository) {}

  async execute(params: UpdateUserAccessParams) {
    try {
      if (!params.userId) {
        return { success: false, message: "User ID is required", status: 400 };
      }

      const updatedUser = await this.repository.updateUserAccess(params.userId, {
        role: params.role,
        banned: params.banned,
        permissions: params.permissions,
      });

      return { success: true, data: updatedUser };
    } catch (error: any) {
      console.error("[UpdateUserAccessUseCase Error]", error);
      return { success: false, message: error.message || "Failed to update user access", status: 500 };
    }
  }
}
