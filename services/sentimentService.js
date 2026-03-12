import Sentiment from 'sentiment';
import logger from '../utils/logger.js';

const analyzer = new Sentiment();

const getMoodLabel = (score) => {
  if (score <= -0.6) return 'very_negative';
  if (score <= -0.2) return 'negative';
  if (score <   0.2) return 'neutral';
  if (score <   0.6) return 'positive';
  return 'very_positive';
};

export const analyzeSentiment = (text) => {
  try {
    const result = analyzer.analyze(text);
    // Sentiment module comparative score is score/words. 
    // For journaling, we want higher sensitivity. Multiplying by 5 makes medium-intensity 
    // sentences hit the 'positive' (0.2) or 'negative' (-0.2) thresholds more easily.
    let normalized = result.comparative * 5.0; 
    const moodScore = parseFloat(Math.max(-1, Math.min(1, normalized)).toFixed(4));
    return {
      moodScore,
      moodLabel: getMoodLabel(moodScore),
      sentimentDetails: {
        score: result.score,
        comparative: result.comparative,
        positive: result.positive,
        negative: result.negative,
      },
    };
  } catch (error) {
    logger.error(`[Sentiment] Analysis failed: ${error.message}`);
    return {
      moodScore: 0,
      moodLabel: 'neutral',
      sentimentDetails: { score: 0, comparative: 0, positive: [], negative: [] },
    };
  }
};