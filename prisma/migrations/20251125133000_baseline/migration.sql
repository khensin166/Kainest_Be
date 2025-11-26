-- Enable uuid extension (needed for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- ENUMS
-- ===========================

CREATE TYPE "NotePermission" AS ENUM ('VIEWER', 'EDITOR');

CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- ===========================
-- TABLE: User
-- ===========================

CREATE TABLE "User" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP,
    "phone_number" TEXT UNIQUE,
    "salary" INTEGER DEFAULT 0,
    "payday" INTEGER DEFAULT 1
);

-- ===========================
-- TABLE: UserProfile
-- ===========================

CREATE TABLE "UserProfile" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "invitationCode" TEXT UNIQUE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "userId" UUID UNIQUE NOT NULL REFERENCES "User"(id) ON DELETE CASCADE
);

-- ===========================
-- TABLE: Couple
-- ===========================

CREATE TABLE "Couple" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user1Id" UUID NOT NULL REFERENCES "User"(id),
    "user2Id" UUID NOT NULL REFERENCES "User"(id),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ===========================
-- TABLE: Photo
-- ===========================

CREATE TABLE "Photo" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "coupleId" UUID REFERENCES "Couple"(id),
    "uploadedBy" UUID NOT NULL REFERENCES "User"(id),
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ===========================
-- TABLE: ShiftActivity
-- ===========================

CREATE TABLE "ShiftActivity" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "shift_type" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "time_start" TEXT NOT NULL,
    "reminder_time" TEXT NOT NULL,
    "note" TEXT
);

CREATE UNIQUE INDEX "shift_unique" ON "ShiftActivity" ("shift_type", "reminder_time");

-- ===========================
-- TABLE: NotificationLog
-- ===========================

CREATE TABLE "NotificationLog" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "User"(id),
    "activityId" UUID NOT NULL REFERENCES "ShiftActivity"(id),
    "sent_at" TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX "notification_unique" ON "NotificationLog" ("userId", "activityId", "sent_at");

-- ===========================
-- TABLE: UserShift
-- ===========================

CREATE TABLE "UserShift" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL REFERENCES "User"(id),
    "date" DATE NOT NULL,
    "shift_type" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX "user_date_unique" ON "UserShift" ("userId", "date");

-- ===========================
-- TABLE: Note
-- ===========================

CREATE TABLE "Note" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "content" JSON NOT NULL,
    "is_public" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP,
    "authorId" UUID NOT NULL REFERENCES "User"(id),
    "coupleId" UUID REFERENCES "Couple"(id),
    "partnerPermission" "NotePermission" DEFAULT 'VIEWER'
);

-- ===========================
-- TABLE: Todo
-- ===========================

CREATE TABLE "Todo" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP,
    "coupleId" UUID NOT NULL REFERENCES "Couple"(id) ON DELETE CASCADE,
    "createdById" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE
);

-- ===========================
-- BUDGETING SYSTEM
-- ===========================

-- BudgetCategory
CREATE TABLE "BudgetCategory" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "type" "TransactionType" DEFAULT 'EXPENSE',
    "icon" TEXT,
    "isDefault" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "userId" UUID REFERENCES "User"(id) ON DELETE CASCADE
);

-- Budget
CREATE TABLE "Budget" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "amount_limit" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "is_ai_adjusted" BOOLEAN DEFAULT FALSE,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "categoryId" UUID NOT NULL REFERENCES "BudgetCategory"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP
);

CREATE UNIQUE INDEX "budget_period_unique" ON "Budget" ("userId", "categoryId", "period");

-- Transaction
CREATE TABLE "Transaction" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP NOT NULL,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "categoryId" UUID NOT NULL REFERENCES "BudgetCategory"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- AI Suggestion
CREATE TABLE "AISuggestion" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "type" TEXT NOT NULL,
    "suggestion_text" TEXT NOT NULL,
    "is_approved" BOOLEAN DEFAULT FALSE,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

