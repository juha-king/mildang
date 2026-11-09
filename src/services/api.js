/**
 * 유일한 API 통신 창구. 프론트엔드 다른 파일에서는 fetch를 직접 호출하지 않습니다.
 * Mock / Real을 같은 응답 형식으로 유지해 서버 연결 시 화면 변경을 최소화합니다.
 */
import {
  ApiError, INDUSTRIES, buildAnalysisRequest, parseAnalysisResponse, parseReportResponse,
} from '../lib/contracts.js';
import { postJson } from './http.js';

export { INDUSTRIES };
export const IS_MOCK = import.meta.env?.VITE_USE_MOCK !== 'false';
const BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('요청 취소', 'AbortError')); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
  function stop() { clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(new DOMException('요청 취소', 'AbortError')); }
  signal?.addEventListener('abort', stop, { once: true });
});

function mockAnalyze(input) {
  const { latitude, longitude, industry, radius_m } = input;
  const seed = Math.abs(Math.round(latitude * 100000) * 31 + Math.round(longitude * 100000) * 19);
  const factor = { cafe: 1, korean: 1.21, chicken: 0.86, snack: 0.79 }[industry];
  const sale = Math.round(((2100 + (seed % 550) * 2) * factor) / 10) * 100000;
  return {
    status: 'success', analysis_id: `demo-${seed}-${industry}-${radius_m}`,
    predicted_monthly_sales_krw: sale, sales_unit: 'KRW/month',
    analysis_level: '시연용 가상 추정', competitor_count: 8 + (seed % 24),
    estimated_daily_foot_traffic: 3200 + (seed % 14) * 530,
    accessibility_score: 58 + (seed % 36), radius_m,
    model_name: 'MOCK — 실제 ML 미연결', mock: true,
  };
}

function errorMessage(code) {
  const messages = {
    DATA_UNAVAILABLE: '이 위치에 대해 학습에 필요한 데이터가 없습니다. 다른 위치를 선택해 주세요.',
    MODEL_UNAVAILABLE: '예측 모델을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    SERVER_ERROR: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  };
  return messages[code] || '요청을 처리하지 못했습니다.';
}

export async function analyzeLocation(input, { signal, scenario = 'success' } = {}) {
  const payload = buildAnalysisRequest(input);
  if (!IS_MOCK) return parseAnalysisResponse(await postJson(BASE_URL, '/api/analyze', payload, { signal }));
  await delay(scenario === 'slow' ? 2400 : 650, signal);
  if (scenario === 'data_unavailable') throw new ApiError(errorMessage('DATA_UNAVAILABLE'), 'DATA_UNAVAILABLE');
  if (scenario === 'model_unavailable') throw new ApiError(errorMessage('MODEL_UNAVAILABLE'), 'MODEL_UNAVAILABLE');
  if (scenario === 'server_error') throw new ApiError(errorMessage('SERVER_ERROR'), 'SERVER_ERROR');
  if (scenario === 'invalid_response') return parseAnalysisResponse({ status: 'success', predicted_monthly_sales_krw: 'wrong' });
  return parseAnalysisResponse(mockAnalyze(payload));
}

export async function generateReport({ analysis, industry, location }, { signal, scenario = 'success' } = {}) {
  if (!analysis?.analysis_id || !location) throw new ApiError('먼저 입지 분석을 진행해 주세요.', 'INVALID_REQUEST');
  if (!IS_MOCK) {
    const data = await postJson(BASE_URL, '/api/report', {
      analysis_id: analysis.analysis_id,
      industry, latitude: location.lat, longitude: location.lng,
    }, { signal });
    return parseReportResponse(data);
  }
  await delay(scenario === 'report_error' ? 550 : 450, signal);
  if (scenario === 'report_error') throw new ApiError('리포트 생성을 테스트용으로 실패 처리했습니다.', 'REPORT_FAILED');
  return parseReportResponse({
    status: 'success', mock: true,
    strengths: `${location.name} 주변에서 ${industry} 업종의 창업 입지를 검토하는 시연용 설명입니다.`,
    risks: `반경 ${analysis.radius_m ?? 500}m의 경쟁 업종 수 등은 가상 데이터입니다. 실제 점포 현황을 확인해야 합니다.`,
    strategy: '시간대별 수요와 주변 점포를 직접 조사하고, 임대료·인건비를 포함한 손익분기점을 계산해 보세요.',
  });
}
