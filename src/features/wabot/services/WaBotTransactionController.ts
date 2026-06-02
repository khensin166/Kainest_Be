import { Context } from "hono";
import { processBotTransactionUseCase } from "../domain/use-cases/ProcessBotTransactionUseCase.js";

export const addBotTransactionController = async (c: Context) => {
  try {
    const body = await c.req.json();

    // Validasi input
    if (!body.sender || !body.text) {
      return c.json({ success: false, message: "Missing required fields: sender, text" }, 400);
    }

    const result = await processBotTransactionUseCase({
      type: body.type || "text",
      text: body.text,
      sender: body.sender,
      groupId: body.groupId,
      timestamp: body.timestamp
    });

    if (!result.success) {
      c.status((result.status as any) || 400);
    }
    return c.json(result);
  } catch (error) {
    console.error("WaBotTransactionController Error:", error);
    return c.json({ success: false, message: "Internal server error processing bot transaction" }, 500);
  }
};
