import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidates } from '../src/lib/comparison.js';

test('지표별 최대값에 대해 정규화하고 동일 가중치로 종합 점수를 계산', () => {
  const [first, second] = scoreCandidates([
    { id: 'a', sales: 100, foot_traffic: 50, accessibility_score: 80 },
    { id: 'b', sales: 50, foot_traffic: 100, accessibility_score: 40 },
  ]);
  assert.equal(first.score, 83);
  assert.equal(second.score, 67);
  assert.equal(first.dataCount, 3);
  assert.deepEqual(first.metricScores, {
    sales: 100, foot_traffic: 50, accessibility_score: 100,
  });
});

test('빠진 지표는 종합 점수에서 제외하고 데이터 개수로 알림', () => {
  const [complete, partial, missing] = scoreCandidates([
    { id: 'a', sales: 100, foot_traffic: 100, accessibility_score: 100 },
    { id: 'b', sales: 50, foot_traffic: null, accessibility_score: 50 },
    { id: 'c', sales: null, foot_traffic: null, accessibility_score: null },
  ]);
  assert.equal(complete.score, 100);
  assert.equal(partial.score, 50);
  assert.equal(partial.dataCount, 2);
  assert.equal(missing.score, null);
  assert.equal(missing.dataCount, 0);
});

test('모든 후보의 값이 0이면 점수도 0으로 처리', () => {
  const scores = scoreCandidates([
    { id: 'a', sales: 0, foot_traffic: 0, accessibility_score: 0 },
    { id: 'b', sales: 0, foot_traffic: 0, accessibility_score: 0 },
  ]);
  assert.deepEqual(scores.map(candidate => candidate.score), [0, 0]);
});
