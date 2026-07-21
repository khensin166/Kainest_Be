-- Migration: update_bot_active_group_view
-- Updates the public view to include userId

DROP VIEW IF EXISTS "public"."BotActiveGroup";

CREATE VIEW "public"."BotActiveGroup" AS
SELECT 
  id,
  "groupId",
  "userId",
  "createdAt"
FROM "kainest"."BotActiveGroup";
