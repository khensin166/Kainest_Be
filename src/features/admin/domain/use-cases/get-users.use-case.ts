import { left, right, Result } from "../../../core/utils/either.js";
import { Failure, ServerFailure } from "../../../core/error/failures.js";
import { AdminRepository } from "../data/admin.repository.js";

export class GetUsersUseCase {
  constructor(private repository: AdminRepository) {}

  async execute(): Promise<Result<Failure, any>> {
    try {
      const users = await this.repository.getAllUsers();
      return right(users);
    } catch (error: any) {
      console.error("[GetUsersUseCase Error]", error);
      return left(new ServerFailure(error.message || "Failed to fetch users"));
    }
  }
}
