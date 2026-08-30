// rbac.route.ts
import { Hono } from "hono";
import { requireAdmin } from "../../../core/middlewares/role.middleware.js";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  assignUserToGroup,
} from "./rbac.controller.js";

const rbacRoute = new Hono();

// Semua route RBAC hanya bisa diakses Admin
rbacRoute.use("*", requireAdmin);

// Group CRUD
rbacRoute.get("/groups", getGroups);
rbacRoute.post("/groups", createGroup);
rbacRoute.put("/groups/:id", updateGroup);
rbacRoute.delete("/groups/:id", deleteGroup);

// Assign user ke group
rbacRoute.put("/users/:userId/assign-group", assignUserToGroup);

export default rbacRoute;
