import { GoogleGenAI } from '@google/genai';
import logger from '../utils/logger.js';

export const generateAdvice = async (transcript, moodLabel) => {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('[AI Advice] GEMINI_API_KEY not set — skipping advice generation');
    return null;
  }

  try {
    const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `SYSTEM: You are a professional emotional wellness coach. Your task is to provide supportive, actionable advice based on a user's journal entry. 
DO NOT write a journal entry. DO NOT say "Here is a journal entry". 
DO NOT be conversational. 
PROVIDE 1 or 2 specific coping strategies or reflections. 
KEEP it under 80 words.

USER JOURNAL ENTRY (Mood: ${moodLabel}):
"${transcript}"`;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();
    
    logger.info(`[AI Advice] Generated advice length: ${aiText.length}`);
    return aiText.trim() || null;

  } catch (error) {
    logger.error(`[AI Advice] Generation failed: ${error.message}`);
    return null;
  }
};