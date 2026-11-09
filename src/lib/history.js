/** 비교 목록은 브라우저 탭의 sessionStorage에 임시 저장합니다. */
export const STORAGE_KEY = 'locally-analysis-history-v2';
export const MAX_COMPARISONS = 3;

export function sameScenario(a, b) {
  return a.industry === b.industry && a.radius_m === b.radius_m && a.mock === b.mock;
}

export function samePlace(a, b) {
  return sameScenario(a, b) && Math.abs(a.latitude - b.latitude) < 0.00015 &&
    Math.abs(a.longitude - b.longitude) < 0.00015;
}

export function comparisonEntries(history, filters) {
  return history.filter(item => item.mock === filters.mock).sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export function addCandidate(history, candidate) {
  const selected = comparisonEntries(history, candidate);
  if (selected.length >= MAX_COMPARISONS) {
    throw new Error('비교 목록에는 최대 3개까지 담을 수 있습니다. 기존 결과를 삭제해 주세요.');
  }
  if (history.some(item => samePlace(item, candidate))) {
    throw new Error('같은 조건으로 분석한 위치가 이미 저장되어 있습니다.');
  }
  return [...history, candidate];
}

export function isCandidate(item) {
  return item && typeof item.id === 'string' && typeof item.label === 'string' &&
    typeof item.industry === 'string' && [300, 500, 1000].includes(item.radius_m) &&
    typeof item.mock === 'boolean' && typeof item.sales === 'number' &&
    Number.isFinite(item.sales) && item.sales >= 0 && Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) && typeof item.saved_at === 'string' &&
    [item.foot_traffic, item.accessibility_score].every(value =>
      value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0));
}

export function readHistory(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isCandidate).slice(-60) : [];
  } catch {
    return [];
  }
}

export function writeHistory(storage, history) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(history)); return true; }
  catch { return false; }
}
