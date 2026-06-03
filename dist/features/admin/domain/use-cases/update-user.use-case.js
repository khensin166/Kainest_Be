export class UpdateUserAccessUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(params) {
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
        }
        catch (error) {
            console.error("[UpdateUserAccessUseCase Error]", error);
            return { success: false, message: error.message || "Failed to update user access", status: 500 };
        }
    }
}
