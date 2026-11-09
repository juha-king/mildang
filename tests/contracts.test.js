import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalysisRequest, parseAnalysisResponse, parseReportResponse,
  formatWonToManwon, optionalMetric,
} from '../src/lib/contracts.js';

const valid = {
  status: 'success', analysis_id: 'a-1', predicted_monthly_sales_krw: 28500000,
  sales_unit: 'KRW/month', competitor_count: 0,
};

test('분석 요청: 올바른 업종, 좌표, 반경', () => {
  assert.deepEqual(buildAnalysisRequest({industry:'cafe',latitude:37.39,longitude:126.95,radius_m:500}), {
    industry:'cafe',latitude:37.39,longitude:126.95,radius_m:500,
  });
});
test('분석 요청: 잘못된 값 차단', () => {
  for (const input of [
    {industry:'unknown',latitude:37.39,longitude:126.95,radius_m:500},
    {industry:'cafe',latitude:'37.39',longitude:126.95,radius_m:500},
    {industry:'cafe',latitude:37.39,longitude:126.95,radius_m:700},
  ]) assert.throws(() => buildAnalysisRequest(input));
});
test('분석 결과: 누락된 선택 지표는 null, 실제 0은 0', () => {
  const parsed = parseAnalysisResponse(valid);
  assert.equal(parsed.predicted_monthly_sales_krw, 28500000);
  assert.equal(parsed.competitor_count, 0);
  assert.equal(parsed.estimated_daily_foot_traffic, null);
  assert.equal(optionalMetric(parsed.estimated_daily_foot_traffic), '자료 없음');
  assert.equal(optionalMetric(parsed.competitor_count), '0');
});
test('분석 결과: 매출값/단위/ID 오류 즉시 차단', () => {
  for (const bad of [
    {...valid, predicted_monthly_sales_krw:'28500000'},
    {...valid, predicted_monthly_sales_krw:-1},
    {...valid, sales_unit:'KRW/year'},
    {...valid, analysis_id:''},
    {...valid, status:'error'},
  ]) assert.throws(() => parseAnalysisResponse(bad));
});
test('리포트: 필수 문장 누락 시 오류', () => {
  assert.throws(() => parseReportResponse({status:'success',strengths:'A',risks:'B'}));
  assert.equal(parseReportResponse({status:'success',strengths:'A',risks:'B',strategy:'C'}).strategy, 'C');
});
test('원 단위 → 만원 표시', () => {
  assert.equal(formatWonToManwon(28500000),'2,850');
});
