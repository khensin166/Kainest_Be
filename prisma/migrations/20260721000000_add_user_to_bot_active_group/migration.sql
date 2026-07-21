-- Migration: add_user_to_bot_active_group
-- Adds optional userId FK to BotActiveGroup for auto-relink feature

ALTER TABLE "kainest"."BotActiveGroup" 
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "kainest"."BotActiveGroup" 
  ADD CONSTRAINT "BotActiveGroup_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "kainest"."User"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "BotActiveGroup_userId_idx" ON "kainest"."BotActiveGroup"("userId");
