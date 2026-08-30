// rbac.controller.ts
import { Context } from "hono";
import { prisma } from "../../../infrastructure/database/prisma.js";
import { logger } from "../../../infrastructure/logger/logger.js";

/**
 * GET /rbac/groups
 * Mengambil seluruh daftar User Group berikut jumlah anggotanya.
 */
export const getGroups = async (c: Context) => {
  try {
    const groups = await prisma.userGroup.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return c.json({ success: true, data: groups });
  } catch (error: any) {
    logger.error("[RBAC] Gagal mengambil daftar group:", { error: error.message });
    return c.json({ success: false, message: "Gagal mengambil data group" }, 500);
  }
};

/**
 * POST /rbac/groups
 * Membuat User Group baru.
 * Body: { name, description?, permissions: string[], isDefault?: boolean }
 */
export const createGroup = async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, description, permissions, isDefault } = body;

    if (!name || !Array.isArray(permissions)) {
      return c.json({ success: false, message: "Field 'name' dan 'permissions' wajib diisi" }, 400);
    }

    // Jika group baru diset sebagai default, unset group default lama
    if (isDefault) {
      await prisma.userGroup.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const group = await prisma.userGroup.create({
      data: {
        name,
        description: description || null,
        permissions,
        isDefault: isDefault || false,
      },
    });

    logger.info("[RBAC] User Group baru dibuat:", { groupId: group.id, name: group.name });
    return c.json({ success: true, data: group }, 201);
  } catch (error: any) {
    if (error.code === "P2002") {
      return c.json({ success: false, message: `Nama group '${(await c.req.json()).name}' sudah digunakan` }, 409);
    }
    logger.error("[RBAC] Gagal membuat group:", { error: error.message });
    return c.json({ success: false, message: "Gagal membuat group" }, 500);
  }
};

/**
 * PUT /rbac/groups/:id
 * Mengedit User Group.
 * Body: { name?, description?, permissions?: string[], isDefault?: boolean }
 */
export const updateGroup = async (c: Context) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const { name, description, permissions, isDefault } = body;

    // Cek apakah group ada
    const existing = await prisma.userGroup.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ success: false, message: "Group tidak ditemukan" }, 404);
    }

    // Jika di-set sebagai default, unset yang lama
    if (isDefault && !existing.isDefault) {
      await prisma.userGroup.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.userGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(permissions !== undefined && { permissions }),
        ...(isDefault !== undefined && { isDefault }),
      },
      include: {
        _count: { select: { users: true } },
      },
    });

    // Jika permissions berubah, sinkronisasikan ke semua user dalam grup ini
    if (permissions !== undefined) {
      await prisma.user.updateMany({
        where: { userGroupId: id },
        data: { permissions },
      });
    }

    logger.info("[RBAC] User Group diperbarui:", { groupId: id });
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === "P2002") {
      return c.json({ success: false, message: "Nama group sudah digunakan" }, 409);
    }
    logger.error("[RBAC] Gagal memperbarui group:", { error: error.message });
    return c.json({ success: false, message: "Gagal memperbarui group" }, 500);
  }
};

/**
 * DELETE /rbac/groups/:id
 * Menghapus User Group.
 * User yang terhubung ke group ini akan di-set userGroupId = null.
 */
export const deleteGroup = async (c: Context) => {
  try {
    const { id } = c.req.param();

    const existing = await prisma.userGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!existing) {
      return c.json({ success: false, message: "Group tidak ditemukan" }, 404);
    }

    if (existing.isDefault) {
      return c.json({ success: false, message: "Group default tidak bisa dihapus. Tetapkan group lain sebagai default terlebih dahulu." }, 400);
    }

    // Unlink semua user dari group ini sebelum hapus
    await prisma.user.updateMany({
      where: { userGroupId: id },
      data: { userGroupId: null },
    });

    await prisma.userGroup.delete({ where: { id } });

    logger.info("[RBAC] User Group dihapus:", { groupId: id, affectedUsers: existing._count.users });
    return c.json({ success: true, message: "Group berhasil dihapus", affectedUsers: existing._count.users });
  } catch (error: any) {
    logger.error("[RBAC] Gagal menghapus group:", { error: error.message });
    return c.json({ success: false, message: "Gagal menghapus group" }, 500);
  }
};

/**
 * PUT /rbac/users/:userId/assign-group
 * Assign user ke sebuah User Group.
 * Body: { groupId: string | null }
 */
export const assignUserToGroup = async (c: Context) => {
  try {
    const { userId } = c.req.param();
    const body = await c.req.json();
    const { groupId } = body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return c.json({ success: false, message: "User tidak ditemukan" }, 404);
    }

    if (groupId) {
      const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
      if (!group) {
        return c.json({ success: false, message: "Group tidak ditemukan" }, 404);
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        userGroupId: groupId || null,
        // Sync permissions field agar kompatibel mundur
        permissions: groupId
          ? (await prisma.userGroup.findUnique({ where: { id: groupId }, select: { permissions: true } }))?.permissions || []
          : [],
      },
      select: {
        id: true,
        email: true,
        role: true,
        userGroupId: true,
        permissions: true,
        userGroup: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });

    logger.info("[RBAC] User di-assign ke group:", { userId, groupId });
    return c.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error("[RBAC] Gagal assign user ke group:", { error: error.message });
    return c.json({ success: false, message: "Gagal assign user ke group" }, 500);
  }
};
