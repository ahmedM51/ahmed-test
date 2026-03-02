
import { getAIResponse } from './geminiService';

export const fetchAIResponse = async (message: string, context?: string) => {
  return await getAIResponse(message, context);
};