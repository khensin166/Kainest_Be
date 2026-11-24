import crypto from "crypto";
import { describe, it, expect } from "vitest";
import { clampLimit, isSafePathSegment, isValidWhatsAppRecipient, timingSafeEqualStrings, verifyHmacSha256Signature, } from "../securityHelpers.js";
describe("securityHelpers", () => {
    it("compares secrets in constant time", () => {
        expect(timingSafeEqualStrings("secret-abc", "secret-abc")).toBe(true);
        expect(timingSafeEqualStrings("secret-abc", "secret-abd")).toBe(false);
        expect(timingSafeEqualStrings("short", "much-longer-secret")).toBe(false);
        expect(timingSafeEqualStrings("", "")).toBe(false);
    });
    it("verifies GOWA HMAC-SHA256 webhook signatures accurately", () => {
        const body = JSON.stringify({ event: "message", payload: { body: "kopi 20k" } });
        const secret = "my-super-webhook-secret";
        const sig = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
        expect(verifyHmacSha256Signature(body, `sha256=${sig}`, secret)).toBe(true);
        expect(verifyHmacSha256Signature(body, sig, secret)).toBe(true);
        expect(verifyHmacSha256Signature(body, "sha256=deadbeef", secret)).toBe(false);
        expect(verifyHmacSha256Signature(body, undefined, secret)).toBe(false);
        expect(verifyHmacSha256Signature(`${body}tampered`, `sha256=${sig}`, secret)).toBe(false);
    });
    it("blocks path traversal in device IDs", () => {
        expect(isSafePathSegment("e30e4ad9-62b2-47f7-be47-c193d8d551e1")).toBe(true);
        expect(isSafePathSegment("device_01")).toBe(true);
        expect(isSafePathSegment("../send/message")).toBe(false);
        expect(isSafePathSegment("abc?foo=bar")).toBe(false);
        expect(isSafePathSegment("")).toBe(false);
    });
    it("clamps pagination limits safely", () => {
        expect(clampLimit(undefined, 20, 100)).toBe(20);
        expect(clampLimit("999999", 20, 100)).toBe(100);
        expect(clampLimit("-5", 20, 100)).toBe(20);
        expect(clampLimit("abc", 20, 100)).toBe(20);
        expect(clampLimit("15", 20, 100)).toBe(15);
    });
    it("validates WhatsApp phone and group JIDs", () => {
        expect(isValidWhatsAppRecipient("6285264351660")).toBe(true);
        expect(isValidWhatsAppRecipient("085264351660")).toBe(true);
        expect(isValidWhatsAppRecipient("120363421885675872@g.us")).toBe(true);
        expect(isValidWhatsAppRecipient("6285264351660@s.whatsapp.net")).toBe(true);
        expect(isValidWhatsAppRecipient("not-a-phone")).toBe(false);
        expect(isValidWhatsAppRecipient("123")).toBe(false);
    });
});
