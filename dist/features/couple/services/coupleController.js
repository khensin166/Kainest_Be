import { getCoupleStatusUseCase } from '../domain/use-cases/GetCoupleStatusUseCase.js';
import { connectCoupleUseCase } from '../domain/use-cases/ConnectCoupleUseCase.js';
export const getCoupleStatusController = async (c) => {
    const userId = c.get('userId');
    const result = await getCoupleStatusUseCase(userId);
    return c.json(result);
};
export const connectCoupleController = async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { invitationCode } = body;
    const result = await connectCoupleUseCase(userId, invitationCode);
    return c.json(result);
};
