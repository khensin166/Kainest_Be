import { Context } from 'hono';
import { WaBotConfigRepository } from '../data/WaBotConfigRepository.js';
import { SaveConfigUseCase } from '../domain/use-cases/SaveConfigUseCase.js';
import { GetConfigUseCase } from '../domain/use-cases/GetConfigUseCase.js';

const repository = new WaBotConfigRepository();

export const saveConfig = async (c: Context) => {
  try {
    const user = c.get('user'); // Pastikan middleware auth sudah berjalan
    const userId = user.id; 
    
    // Ambil data dari body request
    const { baseUrl, adminSecret } = await c.req.json();

    // Validasi sederhana
    if (!baseUrl) {
      return c.json({ status: 'error', message: 'Base URL wajib diisi' }, 400);
    }

    const useCase = new SaveConfigUseCase(repository);
    const result = await useCase.execute(userId, baseUrl, adminSecret);

    return c.json({ status: 'success', data: result });
  } catch (e: any) {
    return c.json({ status: 'error', message: e.message }, 500);
  }
};

export const getConfig = async (c: Context) => {
  try {
    const user = c.get('user');
    const userId = user.id;

    const useCase = new GetConfigUseCase(repository);
    const result = await useCase.execute(userId);

    return c.json({ status: 'success', data: result });
  } catch (e: any) {
    return c.json({ status: 'error', message: e.message }, 500);
  }
};