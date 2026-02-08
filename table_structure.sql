-- public."ApiKeys" definition

-- Drop table

-- DROP TABLE "ApiKeys";

CREATE TABLE "ApiKeys" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	is_active bool DEFAULT true NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT "ApiKeys_key_key" UNIQUE (key),
	CONSTRAINT "ApiKeys_pkey" PRIMARY KEY (id)
);


-- public."ShiftActivity" definition

-- Drop table

-- DROP TABLE "ShiftActivity";

CREATE TABLE "ShiftActivity" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	shift_type text NOT NULL,
	activity_name text NOT NULL,
	time_start text NOT NULL,
	reminder_time text NOT NULL,
	note text NULL,
	CONSTRAINT "ShiftActivity_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX shift_unique ON public."ShiftActivity" USING btree (shift_type, reminder_time);


-- public."User" definition

-- Drop table

-- DROP TABLE "User";

CREATE TABLE "User" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	email text NOT NULL,
	"password" text NULL,
	"name" text NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"updatedAt" timestamp NULL,
	phone_number text NULL,
	salary int4 DEFAULT 0 NULL,
	payday int4 DEFAULT 1 NULL,
	CONSTRAINT "User_email_key" UNIQUE (email),
	CONSTRAINT "User_phone_number_key" UNIQUE (phone_number),
	CONSTRAINT "User_pkey" PRIMARY KEY (id)
);


-- public._prisma_migrations definition

-- Drop table

-- DROP TABLE _prisma_migrations;

CREATE TABLE _prisma_migrations (
	id varchar(36) NOT NULL,
	checksum varchar(64) NOT NULL,
	finished_at timestamptz NULL,
	migration_name varchar(255) NOT NULL,
	logs text NULL,
	rolled_back_at timestamptz NULL,
	started_at timestamptz DEFAULT now() NOT NULL,
	applied_steps_count int4 DEFAULT 0 NOT NULL,
	CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
);


-- public."AISuggestion" definition

-- Drop table

-- DROP TABLE "AISuggestion";

CREATE TABLE "AISuggestion" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"type" text NOT NULL,
	suggestion_text text NOT NULL,
	is_approved bool DEFAULT false NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	CONSTRAINT "AISuggestion_pkey" PRIMARY KEY (id),
	CONSTRAINT "AISuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."BudgetCategory" definition

-- Drop table

-- DROP TABLE "BudgetCategory";

CREATE TABLE "BudgetCategory" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"name" text NOT NULL,
	"type" public."TransactionType" DEFAULT 'EXPENSE'::"TransactionType" NULL,
	icon text NULL,
	"isDefault" bool DEFAULT false NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"userId" uuid NULL,
	CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY (id),
	CONSTRAINT "BudgetCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."Couple" definition

-- Drop table

-- DROP TABLE "Couple";

CREATE TABLE "Couple" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"user1Id" uuid NOT NULL,
	"user2Id" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	CONSTRAINT "Couple_pkey" PRIMARY KEY (id),
	CONSTRAINT "Couple_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"(id),
	CONSTRAINT "Couple_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"(id)
);


-- public."Note" definition

-- Drop table

-- DROP TABLE "Note";

CREATE TABLE "Note" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	title text NOT NULL,
	"content" json NOT NULL,
	is_public bool DEFAULT false NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"updatedAt" timestamp NULL,
	"authorId" uuid NOT NULL,
	"coupleId" uuid NULL,
	"partnerPermission" public."NotePermission" DEFAULT 'VIEWER'::"NotePermission" NULL,
	CONSTRAINT "Note_pkey" PRIMARY KEY (id),
	CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id),
	CONSTRAINT "Note_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"(id)
);


-- public."NotificationLog" definition

-- Drop table

-- DROP TABLE "NotificationLog";

CREATE TABLE "NotificationLog" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"userId" uuid NOT NULL,
	"activityId" uuid NOT NULL,
	sent_at timestamp DEFAULT now() NULL,
	CONSTRAINT "NotificationLog_pkey" PRIMARY KEY (id),
	CONSTRAINT "NotificationLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ShiftActivity"(id),
	CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
);
CREATE UNIQUE INDEX notification_unique ON public."NotificationLog" USING btree ("userId", "activityId", sent_at);


-- public."Photo" definition

-- Drop table

-- DROP TABLE "Photo";

CREATE TABLE "Photo" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"imageUrl" text NOT NULL,
	caption text NULL,
	"coupleId" uuid NULL,
	"uploadedBy" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	CONSTRAINT "Photo_pkey" PRIMARY KEY (id),
	CONSTRAINT "Photo_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"(id),
	CONSTRAINT "Photo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"(id)
);


-- public."Todo" definition

-- Drop table

-- DROP TABLE "Todo";

CREATE TABLE "Todo" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	title text NOT NULL,
	description text NULL,
	is_completed bool DEFAULT false NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"updatedAt" timestamp NULL,
	"coupleId" uuid NOT NULL,
	"createdById" uuid NOT NULL,
	CONSTRAINT "Todo_pkey" PRIMARY KEY (id),
	CONSTRAINT "Todo_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"(id) ON DELETE CASCADE,
	CONSTRAINT "Todo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."Transaction" definition

-- Drop table

-- DROP TABLE "Transaction";

CREATE TABLE "Transaction" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	amount int4 NOT NULL,
	note text NULL,
	"date" timestamp NOT NULL,
	"userId" uuid NOT NULL,
	"categoryId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	CONSTRAINT "Transaction_pkey" PRIMARY KEY (id),
	CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"(id) ON DELETE CASCADE,
	CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."UserProfile" definition

-- Drop table

-- DROP TABLE "UserProfile";

CREATE TABLE "UserProfile" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"displayName" text NULL,
	"avatarUrl" text NULL,
	"invitationCode" text NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "UserProfile_invitationCode_key" UNIQUE ("invitationCode"),
	CONSTRAINT "UserProfile_pkey" PRIMARY KEY (id),
	CONSTRAINT "UserProfile_userId_key" UNIQUE ("userId"),
	CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."UserShift" definition

-- Drop table

-- DROP TABLE "UserShift";

CREATE TABLE "UserShift" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"userId" uuid NOT NULL,
	"date" date NOT NULL,
	shift_type text NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	CONSTRAINT "UserShift_pkey" PRIMARY KEY (id),
	CONSTRAINT "UserShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id)
);
CREATE UNIQUE INDEX user_date_unique ON public."UserShift" USING btree ("userId", date);


-- public.wa_bot_configs definition

-- Drop table

-- DROP TABLE wa_bot_configs;

CREATE TABLE wa_bot_configs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	base_url text NOT NULL,
	admin_secret text NULL,
	created_at timestamptz DEFAULT now() NULL,
	updated_at timestamptz DEFAULT now() NULL,
	CONSTRAINT wa_bot_configs_pkey PRIMARY KEY (id),
	CONSTRAINT wa_bot_configs_user_id_key UNIQUE (user_id),
	CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);


-- public."Budget" definition

-- Drop table

-- DROP TABLE "Budget";

CREATE TABLE "Budget" (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	amount_limit int4 NOT NULL,
	"period" date NOT NULL,
	is_ai_adjusted bool DEFAULT false NULL,
	"userId" uuid NOT NULL,
	"categoryId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NULL,
	"updatedAt" timestamp NULL,
	CONSTRAINT "Budget_pkey" PRIMARY KEY (id),
	CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"(id) ON DELETE CASCADE,
	CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX budget_period_unique ON public."Budget" USING btree ("userId", "categoryId", period);