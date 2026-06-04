import type { Context } from "hono";
import { prisma } from "../../../infrastructure/database/prisma.js";

/**
 * GET /system-updates
 * Ambil changelog dari DB untuk frontend dashboard.
 */
export async function getSystemUpdatesController(c: Context) {
  try {
    const limit = Number(c.req.query("limit") ?? 5);

    const updates = await prisma.systemUpdate.findMany({
      orderBy: { date: "desc" },
      take: limit,
    });

    return c.json({ updates });
  } catch (error) {
    console.error("[SystemUpdate] Error fetching:", error);
    return c.json({ error: "Gagal mengambil system updates" }, 500);
  }
}

/**
 * POST /system-updates/sync
 * Admin only: Tarik releases dari GitHub, simpan ke DB, dan blast notifikasi jika ada [BLAST].
 */
export async function syncGithubReleasesController(c: Context) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const repoOwner = "khensin166";
    const repoName = "Kainest"; // Gunakan frontend repo as source of truth for releases, or backend? We assume frontend repo "Kainest"

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Kainest-Backend",
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases`, { headers });
    if (!response.ok) {
      const errText = await response.text();
      console.error("[SystemUpdate] GitHub API error:", response.status, errText);
      return c.json({ error: "Gagal menghubungi GitHub API" }, 500);
    }

    const releases = await response.json();
    if (!Array.isArray(releases)) {
      return c.json({ error: "Format respons GitHub tidak valid" }, 500);
    }

    let newlyAdded = 0;
    let blasted = 0;

    for (const release of releases) {
      if (release.draft || release.prerelease) continue;

      const version = release.tag_name; // e.g. "v1.3.0"
      
      // Check if already exists in DB
      const existing = await prisma.systemUpdate.findUnique({
        where: { version },
      });

      if (existing) continue; // Skip if already synced

      // It's a new release!
      const descriptionRaw = release.body || "";
      const isBlast = descriptionRaw.includes("[BLAST]");
      
      // Clean description for DB
      const cleanDescription = descriptionRaw.replace("[BLAST]", "").trim();
      
      await prisma.systemUpdate.create({
        data: {
          version,
          title: release.name || version,
          description: cleanDescription,
          date: new Date(release.published_at),
          url: release.html_url,
          badge: "Baru",
        }
      });
      newlyAdded++;

      // Blast notifications if requested
      if (isBlast) {
        // Find all users
        const users = await prisma.user.findMany({ select: { id: true } });
        const notificationsData = users.map(u => ({
          userId: u.id,
          title: `Update Baru: ${release.name || version}`,
          message: cleanDescription,
          type: "SYSTEM",
        }));

        if (notificationsData.length > 0) {
          await prisma.appNotification.createMany({
            data: notificationsData,
          });
        }
        blasted++;
      }
    }

    return c.json({ success: true, newlyAdded, blasted });
  } catch (error) {
    console.error("[SystemUpdate] Error syncing:", error);
    return c.json({ error: "Terjadi kesalahan saat sync dari GitHub" }, 500);
  }
}
