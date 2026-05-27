# 🤖 Kainest Backend - AI Agent Guidelines

Welcome to the Kainest Backend project. Please read these guidelines before making changes to the codebase.

## 🛠️ Tech Stack
- **Framework**: Hono (Node.js)
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma (`src/infrastructure/database/prisma.ts`)
- **Authentication**: Better Auth (`src/infrastructure/auth.ts`)
- **Deployment**: Vercel / Node.js environment

## 🏗️ Architecture & Structure
This project follows a **Feature-Based Clean Architecture**. This makes the code modular, maintainable, and scalable.

```text
src/
├── app.ts                 # Hono app initialization, global middlewares, & route registration
├── server.ts              # Entry point (runs the server)
├── core/                  # Core logic, configurations, and global error handling
├── infrastructure/        # 3rd party integrations (Prisma, Better Auth, etc.)
├── utils/                 # Helper and utility functions
└── features/              # Feature modules (Domain-Driven)
```

### Feature Module Structure (e.g., `features/auth/`)
Every feature is divided into three layers:
- `presentation/`: Controllers and Routes. Handles HTTP requests and responses.
- `domain/`: Use Cases and Entities. Contains the core business logic.
- `data/`: Repositories. Handles data fetching and persistence (e.g., calling Prisma).

**Data Flow**: Route -> Controller -> Use Case -> Repository -> Database.

## 🔒 Authentication Flow
We use **Better Auth** with cookie-based sessions that are shared across subdomains.
- `crossSubDomainCookies` is enabled.
- For local development, `domain` is omitted and `sameSite` is `lax` so it works over HTTP.
- For production, `domain` is set to `.kenantomfie.site` with `sameSite=none` and `secure=true` so cookies are shared between the frontend (`staging.kainest...`) and backend (`staging.kainest.be...`).

## 📝 Rules for Agents
- **Always preserve Clean Architecture**: Do NOT call Prisma or external services directly from a Controller. Use a Repository and Use Case.
- **Return Standard Types**: Use the `Result` pattern (`left`, `right`) for handling failures and successes across layers.
- **Keep Routes Clean**: The presentation layer should only extract parameters and format responses. Logic belongs in `domain/`.

## 🛡️ Role-Based Access Control (RBAC) & Admin Feature
- **Implementation**: We use the Better Auth `admin()` plugin which manages `role`, `banned`, `banReason`, and `banExpires` fields natively. We also added a custom `permissions` array (String[]) to the Prisma `User` schema for granular module access.
- **Protection**: Use the `requireAdmin` middleware (`src/core/middlewares/role.middleware.ts`) to protect endpoints that should only be accessible by administrators.
- **Architecture**: The Admin functionality (getting users, updating access/roles) is encapsulated within `features/admin/` following Clean Architecture principles.

## 🔄 Recent Updates
- **RBAC Schema & Endpoints**: Added `role` and `permissions` (String[]) to the Prisma `User` schema. Built the Admin API (`GET /admin/users`, `PATCH /admin/users/:id/access`) to manage these properties securely.
- **Better Auth Syncing**: Discovered and resolved discrepancies between custom endpoints and native Better Auth endpoints (utilizing native `/auth/sign-in/email`, `/auth/sign-up/email`, and `/auth/sign-out` routes).
- **Secure Cloudinary Integration**: Added `getUploadSignatureController` to generate secure timestamps and signatures for frontend-direct image uploading without passing images through the Node.js server.
- **Vercel Serverless Optimization**: Emphasized the necessity of aligning Vercel Function Regions with Supabase Regions (e.g., Singapore `sin1`) to minimize cross-continental latency bottlenecks. Also highlighted environment variable syncing for Vercel deployments.
