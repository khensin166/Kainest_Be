/**
 * Menghasilkan string alfanumerik acak dengan panjang tertentu.
 * Sebuah utility untuk membuat kode undangan.
 */
export const generateInviteCode = (length = 8): string => {
  // Menghasilkan string acak (misal: "A1B2C3D4")
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();
}