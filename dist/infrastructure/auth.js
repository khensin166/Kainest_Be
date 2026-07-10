import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { logger } from "./logger/logger.js";
import { admin, bearer } from "better-auth/plugins";
import { prisma } from "./database/prisma.js";
import { Resend } from "resend";
import { getResetPasswordEmailHtml } from "./email/templates/resetPasswordTemplate.js";
const isLocal = process.env.NODE_ENV !== "production" && (!process.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL.includes("localhost"));
const resend = new Resend(process.env.RESEND_API_KEY);
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
    user: {
        additionalFields: {
            whatsappJid: {
                type: "string",
                required: false,
                fieldName: "whatsappJid",
            },
            phone_number: {
                type: "string",
                required: false,
                fieldName: "phone_number",
            },
        },
    },
    account: {
        accountLinking: {
            enabled: true,
            trustedProviders: ["google", "github"],
        },
    },
    basePath: "/auth",
    emailAndPassword: {
        enabled: true,
        async sendResetPassword({ user, url, token }, request) {
            try {
                const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
                const htmlBody = getResetPasswordEmailHtml(user.name || 'Pengguna Kainest', url);
                const data = await resend.emails.send({
                    from: fromEmail,
                    to: user.email,
                    subject: "Reset Kata Sandi Kainest",
                    html: htmlBody,
                });
                logger.debug("[Auth] Email reset kata sandi terkirim:", { data });
            }
            catch (error) {
                logger.error("[Auth] Gagal mengirim email reset kata sandi:", { error: error.message });
            }
        },
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
    },
    plugins: [admin(), bearer()],
    advanced: {
        crossSubDomainCookies: {
            enabled: !isLocal,
            domain: isLocal ? undefined : "kenantomfie.site",
        },
        defaultCookieAttributes: {
            sameSite: isLocal ? "lax" : "none",
            secure: !isLocal
        }
    },
});
