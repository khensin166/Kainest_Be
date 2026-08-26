import { Context } from "hono";
import { GetUsersUseCase } from "../domain/use-cases/get-users.use-case.js";
import { UpdateUserAccessUseCase } from "../domain/use-cases/update-user.use-case.js";
import { TriggerMonthlyResetUseCase } from "../domain/use-cases/trigger-monthly-reset.use-case.js";

export class AdminController {
  constructor(
    private getUsersUseCase: GetUsersUseCase,
    private updateUserAccessUseCase: UpdateUserAccessUseCase,
    private triggerMonthlyResetUseCase: TriggerMonthlyResetUseCase
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

  async triggerMonthlyReset(c: Context) {
    const body = await c.req.json().catch(() => ({}));
    const targetUserId = body.targetUserId;

    if (!targetUserId) {
      return c.json({ success: false, message: "targetUserId is required in body." }, 400);
    }

    const result = await this.triggerMonthlyResetUseCase.execute(targetUserId);

    if (!result.success) {
      return c.json({ success: false, message: result.message }, 400);
    }
    return c.json(result, 200);
  }
}
