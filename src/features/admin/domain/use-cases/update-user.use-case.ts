import { left, right, Result } from "../../../core/utils/either.js";
import { Failure, ServerFailure, BadRequestFailure } from "../../../core/error/failures.js";
import { AdminRepository } from "../data/admin.repository.js";

interface UpdateUserAccessParams {
  userId: string;
  role?: string;
  banned?: boolean;
  permissions?: string[];
}

export class UpdateUserAccessUseCase {
  constructor(private repository: AdminRepository) {}

  async execute(params: UpdateUserAccessParams): Promise<Result<Failure, any>> {
    try {
      if (!params.userId) {
        return left(new BadRequestFailure("User ID is required"));
      }

      const updatedUser = await this.repository.updateUserAccess(params.userId, {
        role: params.role,
        banned: params.banned,
        permissions: params.permissions,
      });

      return right(updatedUser);
    } catch (error: any) {
      console.error("[UpdateUserAccessUseCase Error]", error);
      return left(new ServerFailure(error.message || "Failed to update user access"));
    }
  }
}
