import { Context } from "hono";
import { GetUsersUseCase } from "../domain/use-cases/get-users.use-case.js";
import { UpdateUserAccessUseCase } from "../domain/use-cases/update-user.use-case.js";

export class AdminController {
  constructor(
    private getUsersUseCase: GetUsersUseCase,
    private updateUserAccessUseCase: UpdateUserAccessUseCase
  ) {}

  async getUsers(c: Context) {
    const result = await this.getUsersUseCase.execute();
    return result.fold(
      (failure) => c.json({ success: false, message: failure.message }, 500),
      (users) => c.json({ success: true, data: users }, 200)
    );
  }

  async updateUserAccess(c: Context) {
    const userId = c.req.param("id");
    const body = await c.req.json();

    const result = await this.updateUserAccessUseCase.execute({
      userId,
      role: body.role,
      banned: body.banned,
      permissions: body.permissions,
    });

    return result.fold(
      (failure) => c.json({ success: false, message: failure.message }, 400),
      (user) => c.json({ success: true, data: user }, 200)
    );
  }
}
