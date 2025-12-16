import { WaBotConfigRepository } from '../../data/WaBotConfigRepository.js';

export class GetConfigUseCase {
  constructor(private repository: WaBotConfigRepository) {}

  async execute(userId: string) {
    return this.repository.getConfig(userId);
  }
}