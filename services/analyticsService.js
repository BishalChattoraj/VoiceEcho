import JournalEntry from '../models/JournalEntry.js';

export const getWeeklyAnalytics = async (userId) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const entries = await JournalEntry.find({
    user: userId,
    recordedAt: { $gte: sevenDaysAgo },
  }).sort({ recordedAt: 1 });

  if (!entries.length) {
    return { totalEntries: 0, averageMoodScore: null, moodDistribution: {}, streak: 0, entries: [] };
  }

  const averageMoodScore = parseFloat(
    (entries.reduce((sum, e) => sum + e.moodScore, 0) / entries.length).toFixed(4)
  );

  const moodDistribution = entries.reduce((acc, e) => {
    acc[e.moodLabel] = (acc[e.moodLabel] || 0) + 1;
    return acc;
  }, {});

  return {
    totalEntries: entries.length,
    averageMoodScore,
    moodDistribution,
    streak: computeStreak(entries),
    entries: entries.map((e) => ({
      id: e._id,
      moodScore: e.moodScore,
      moodLabel: e.moodLabel,
      recordedAt: e.recordedAt,
    })),
  };
};

export const getAllTimeAnalytics = async (userId) => {
  const result = await JournalEntry.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: { year: { $year: '$recordedAt' }, month: { $month: '$recordedAt' } },
        averageMoodScore: { $avg: '$moodScore' },
        entryCount: { $sum: 1 },
        labels: { $push: '$moodLabel' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return result.map((r) => ({
    year: r._id.year,
    month: r._id.month,
    averageMoodScore: parseFloat(r.averageMoodScore.toFixed(4)),
    entryCount: r.entryCount,
    moodDistribution: r.labels.reduce((acc, l) => {
      acc[l] = (acc[l] || 0) + 1;
      return acc;
    }, {}),
  }));
};

const computeStreak = (entries) => {
  if (!entries.length) return 0;

  const dates = [
    ...new Set(entries.map((e) => e.recordedAt.toISOString().split('T')[0])),
  ].sort().reverse();

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
};