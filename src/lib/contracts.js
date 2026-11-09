/**
 * API 계약과 화면에서 사용하는 입력/응답 검증.
 * 브라우저에선 타입스크립트가 없어도 API 필드 오타를 조기 발견할 수 있습니다.
 */
export const INDUSTRIES = Object.freeze([
  { code: 'cafe', label: '카페 · 디저트' },
  { code: 'korean', label: '한식 음식점' },
  { code: 'chicken', label: '치킨 · 패스트푸드' },
  { code: 'snack', label: '분식 · 간편식' },
]);
export const RADII = Object.freeze([300, 500, 1000]);
export const REQUIRED_SALES_UNIT = 'KRW/month';

export class ApiError extends Error {
  constructor(message, code = 'UNKNOWN', status = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function buildAnalysisRequest({ industry, latitude, longitude, radius_m }) {
  if (!INDUSTRIES.some(item => item.code === industry)) {
    throw new ApiError('지원하지 않는 업종입니다.', 'UNSUPPORTED_INDUSTRY');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ApiError('유효한 지도 위치를 선택해 주세요.', 'INVALID_LOCATION');
  }
  if (!RADII.includes(radius_m)) {
    throw new ApiError('분석 반경을 다시 선택해 주세요.', 'INVALID_RADIUS');
  }
  return { industry, latitude, longitude, radius_m };
}

function nonnegativeNumber(value, field, { optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ApiError(`서버 응답의 ${field} 값이 올바르지 않습니다. 백엔드 API 명세를 확인해 주세요.`, 'INVALID_RESPONSE');
  }
  return value;
}

export function parseAnalysisResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.status !== 'success') {
    throw new ApiError('분석 결과 형식이 올바르지 않습니다.', 'INVALID_RESPONSE');
  }
  if (typeof data.analysis_id !== 'string' || !data.analysis_id.trim()) {
    throw new ApiError('분석 ID가 누락되었습니다.', 'INVALID_RESPONSE');
  }
  if (data.sales_unit !== REQUIRED_SALES_UNIT) {
    throw new ApiError('매출 단위가 일치하지 않습니다. KRW/month 형식이 필요합니다.', 'INVALID_RESPONSE');
  }
  return {
    status: 'success',
    analysis_id: data.analysis_id,
    predicted_monthly_sales_krw: nonnegativeNumber(data.predicted_monthly_sales_krw, 'predicted_monthly_sales_krw'),
    sales_unit: REQUIRED_SALES_UNIT,
    analysis_level: typeof data.analysis_level === 'string' ? data.analysis_level : '분석 기준 미제공',
    competitor_count: nonnegativeNumber(data.competitor_count, 'competitor_count', { optional: true }),
    estimated_daily_foot_traffic: nonnegativeNumber(data.estimated_daily_foot_traffic, 'estimated_daily_foot_traffic', { optional: true }),
    accessibility_score: nonnegativeNumber(data.accessibility_score, 'accessibility_score', { optional: true }),
    model_name: typeof data.model_name === 'string' ? data.model_name : '정보 없음',
    radius_m: RADII.includes(data.radius_m) ? data.radius_m : null,
    mock: data.mock === true,
  };
}

export function parseReportResponse(data) {
  if (!data || data.status !== 'success') throw new ApiError('리포트 형식이 올바르지 않습니다.', 'INVALID_RESPONSE');
  const fields = ['strengths', 'risks', 'strategy'];
  if (!fields.every(field => typeof data[field] === 'string' && data[field].trim())) {
    throw new ApiError('리포트 내용 일부가 누락되었습니다.', 'INVALID_RESPONSE');
  }
  return {
    status: 'success',
    strengths: data.strengths,
    risks: data.risks,
    strategy: data.strategy,
    mock: data.mock === true,
  };
}

export function formatWonToManwon(value) {
  if (value === null || value === undefined) return '-';
  return Math.round(value / 10000).toLocaleString('ko-KR');
}

export function displayMoney(value) {
  if (value === null || value === undefined) return '-';
  const manwon = Math.round(value / 10000);
  return manwon >= 10000 ? `${(manwon / 10000).toFixed(1)}억 원` : `${manwon.toLocaleString('ko-KR')}만 원`;
}

export function optionalMetric(value) {
  return value === null || value === undefined ? '자료 없음' : Number(value).toLocaleString('ko-KR');
}
