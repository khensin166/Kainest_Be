import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./database/prisma.js";

const isProdOrStaging = process.env.NODE_ENV === 'production' || process.env.BETTER_AUTH_URL?.includes('kenantomfie.site');

export const auth = betterAuth({
  trustedOrigins: [
    "http://localhost:5173", 
    "https://staging.kainest.kenantomfie.site", 
    "https://kainest.kenantomfie.site",
    "https://staging.kainest.be.kenantomfie.site"
  ],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  basePath: "/auth",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  cookie: {
    domain: isProdOrStaging ? ".kenantomfie.site" : undefined,
  }
});
