export class AdminController {
    constructor(getUsersUseCase, updateUserAccessUseCase, triggerMonthlyResetUseCase) {
        this.getUsersUseCase = getUsersUseCase;
        this.updateUserAccessUseCase = updateUserAccessUseCase;
        this.triggerMonthlyResetUseCase = triggerMonthlyResetUseCase;
    }
    async getUsers(c) {
        const result = await this.getUsersUseCase.execute();
        if (!result.success) {
            return c.json({ success: false, message: result.message }, 500);
        }
        return c.json(result, 200);
    }
    async updateUserAccess(c) {
        const userId = c.req.param("id");
        const body = await c.req.json();
        const result = await this.updateUserAccessUseCase.execute({
            userId,
            role: body.role,
            banned: body.banned,
            permissions: body.permissions,
        });
        if (!result.success) {
            return c.json({ success: false, message: result.message }, result.status || 400);
        }
        return c.json(result, 200);
    }
    async triggerMonthlyReset(c) {
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
