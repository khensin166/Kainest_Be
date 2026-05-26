import { Hono } from "hono";
import { requireAdmin } from "../../../core/middlewares/role.middleware.js";
import { AdminRepository } from "../data/admin.repository.js";
import { GetUsersUseCase } from "../domain/use-cases/get-users.use-case.js";
import { UpdateUserAccessUseCase } from "../domain/use-cases/update-user.use-case.js";
import { AdminController } from "./admin.controller.js";
const adminRoute = new Hono();
// Setup Dependencies
const repository = new AdminRepository();
const getUsersUseCase = new GetUsersUseCase(repository);
const updateUserAccessUseCase = new UpdateUserAccessUseCase(repository);
const controller = new AdminController(getUsersUseCase, updateUserAccessUseCase);
// Terapkan middleware requireAdmin ke semua rute di /admin
adminRoute.use("*", requireAdmin);
// Endpoints
adminRoute.get("/users", (c) => controller.getUsers(c));
adminRoute.put("/users/:id/access", (c) => controller.updateUserAccess(c));
export default adminRoute;
