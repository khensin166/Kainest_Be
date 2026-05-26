export class AdminController {
    constructor(getUsersUseCase, updateUserAccessUseCase) {
        this.getUsersUseCase = getUsersUseCase;
        this.updateUserAccessUseCase = updateUserAccessUseCase;
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
}
