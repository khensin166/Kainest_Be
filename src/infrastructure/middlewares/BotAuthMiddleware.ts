import { Context, Next } from "hono";
import { timingSafeEqualStrings } from "../../utils/securityHelpers.js";

export const botAuthMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header("x-api-key") || c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  
  const validApiKey = process.env.WA_BOT_API_KEY;

  if (!validApiKey) {
    console.warn("WA_BOT_API_KEY is not set in environment variables!");
    return c.json({ success: false, message: "Server configuration error" }, 500);
  }

  if (!timingSafeEqualStrings(apiKey, validApiKey)) {
    return c.json({ success: false, message: "Unauthorized: Invalid API Key" }, 401);
  }

  await next();
};
