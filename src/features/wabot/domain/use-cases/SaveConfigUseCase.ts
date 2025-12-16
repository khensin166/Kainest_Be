import { WaBotConfigRepository } from '../../data/WaBotConfigRepository.js';

export class SaveConfigUseCase {
  constructor(private repository: WaBotConfigRepository) {}

  async execute(userId: string, baseUrl: string, adminSecret?: string) {
    // Validasi URL sederhana
    if (!baseUrl.startsWith('http')) throw new Error('URL tidak valid');
    // Hapus slash di akhir agar konsisten
    const cleanUrl = baseUrl.replace(/\/$/, ""); 
    return this.repository.upsertConfig(userId, cleanUrl, adminSecret);
  }
}