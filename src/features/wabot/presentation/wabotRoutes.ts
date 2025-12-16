import { Hono } from "hono";
import * as controller from "../services/WaBotConfigController.js";
// import authMiddleware ...

const app = new Hono();

app.post("/config", controller.saveConfig);
app.get("/config", controller.getConfig);

export default app;
