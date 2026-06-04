export const getResetPasswordEmailHtml = (userName: string, resetUrl: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #111827; margin-bottom: 8px;">Halo ${userName},</h2>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Kami menerima permintaan untuk mengatur ulang kata sandi akun Kainest Anda.</p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px;">Silakan klik tombol di bawah ini untuk membuat sandi baru:</p>
      <a href="${resetUrl}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        Reset Kata Sandi
      </a>
    </div>

    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eaeaea; text-align: center;">
      <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin-bottom: 8px;">Tautan ini hanya berlaku untuk waktu yang terbatas demi keamanan akun Anda.</p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.4;">Jika Anda tidak pernah meminta reset kata sandi, abaikan saja email ini. Akun Anda akan tetap aman.</p>
    </div>
  </div>
`;
