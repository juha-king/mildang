export const COMPARISON_METRICS = Object.freeze([
  { key: 'sales', label: '예상 월매출', unit: '원' },
  { key: 'foot_traffic', label: '일평균 유동인구', unit: '명/일' },
  { key: 'accessibility_score', label: '접근성 지수', unit: '점' },
]);

export function scoreCandidates(entries) {
  const maximums = Object.fromEntries(COMPARISON_METRICS.map(metric => [
    metric.key,
    Math.max(0, ...entries.map(item => {
      const value = item[metric.key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
    })),
  ]));

  return entries.map(item => {
    const metricScores = Object.fromEntries(COMPARISON_METRICS.map(metric => {
      const value = item[metric.key];
      const available = typeof value === 'number' && Number.isFinite(value) && value >= 0;
      const maximum = maximums[metric.key];
      return [metric.key, available ? (maximum > 0 ? value / maximum * 100 : 0) : null];
    }));
    const availableScores = Object.values(metricScores).filter(score => score !== null);
    return {
      item,
      metricScores,
      score: availableScores.length
        ? Math.round(availableScores.reduce((total, score) => total + score, 0) / availableScores.length)
        : null,
      dataCount: availableScores.length,
    };
  });
}
