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
    if (!result.success) {
      return c.json({ success: false, message: result.message }, 500);
    }
    return c.json(result, 200);
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

    if (!result.success) {
      return c.json({ success: false, message: result.message }, (result as any).status || 400);
    }
    return c.json(result, 200);
  }
}
