export class GetUsersUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute() {
        try {
            const users = await this.repository.getAllUsers();
            return { success: true, data: users };
        }
        catch (error) {
            console.error("[GetUsersUseCase Error]", error);
            return { success: false, message: error.message || "Failed to fetch users" };
        }
    }
}
