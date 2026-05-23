import { cloudinary } from "../../../infrastructure/cloud/cloudinaryClient.js";
// Whitelist folder yang diperbolehkan untuk upload
const ALLOWED_FOLDERS = [
    "kainest_avatars", // Untuk Profile
    "kainest_notes", // Untuk Notes
    "kainest_todos" // Future proofing
];
export const getUploadSignatureController = async (c) => {
    try {
        const body = await c.req.json().catch(() => ({})); // Handle jika body kosong
        const folder = body.folder;
        // 1. Validasi Folder (Security)
        if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
            return c.json({
                success: false,
                message: "Invalid or missing folder name. Allowed: " + ALLOWED_FOLDERS.join(", ")
            }, 400);
        }
        // 2. Setup Parameter Signature
        const timestamp = Math.round(new Date().getTime() / 1000);
        const paramsToSign = {
            timestamp: timestamp,
            folder: folder,
        };
        // 3. Ambil Secret
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!apiSecret) {
            throw new Error("CLOUDINARY_API_SECRET is not set");
        }
        // 4. Generate Signature
        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
        // 5. Return Response
        return c.json({
            success: true,
            signature: signature,
            timestamp: timestamp,
            folder: folder,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        });
    }
    catch (error) {
        console.error("Error generating dynamic upload signature:", error);
        return c.json({ success: false, message: "Failed to generate signature" }, 500);
    }
};
