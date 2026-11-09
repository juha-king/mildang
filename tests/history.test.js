import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, addCandidate, comparisonEntries, readHistory, samePlace, writeHistory } from '../src/lib/history.js';

const candidate = (id, props={}) => ({
  id, label:id, industry:'cafe', radius_m:500, mock:true,
  latitude:37.390 + Number(id.replace(/\D/g,''))*0.002,longitude:126.950,
  sales:28000000,saved_at:'2026-11-09T00:00:00.000Z', ...props,
});

test('후보지 3개까지만 저장 가능', () => {
  const three = [candidate('s1'), candidate('s2'), candidate('s3')];
  assert.throws(() => addCandidate(three,candidate('s4')), /최대 3개/);
});
test('같은 업종/반경/데이터 모드와 가까운 좌표 중복 제한', () => {
  const a=candidate('s1');
  const b=candidate('b',{latitude:a.latitude + 0.00005});
  assert.equal(samePlace(a,b),true);
  assert.throws(() => addCandidate([a],b), /이미 저장/);
});
test('다른 업종과 반경도 비교하고 실제와 시연 결과만 분리', () => {
  const items=[candidate('s1'),candidate('s2',{industry:'korean'}),candidate('s3',{radius_m:1000}),candidate('s4',{mock:false})];
  assert.equal(comparisonEntries(items,{industry:'cafe',radius_m:500,mock:true}).length,3);
  assert.throws(() => addCandidate(items,candidate('s5')), /최대 3개/);
});
test('localStorage 저장 및 손상 복구', () => {
  const store = new Map();
  const local = {getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  assert.equal(writeHistory(local,[candidate('s1')]),true);
  assert.equal(readHistory(local).length,1);
  store.set(STORAGE_KEY,'{broken-json');
  assert.deepEqual(readHistory(local),[]);
});

test('새 비교 지표 저장 및 기존 후보 기록 호환', () => {
  const store = new Map();
  const local = {getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  const first = candidate('s1', { foot_traffic: 1250, accessibility_score: 82 });
  assert.equal(writeHistory(local, [first]), true);
  assert.deepEqual(readHistory(local)[0], first);

  const legacy = candidate('s2');
  assert.equal(writeHistory(local, [legacy]), true);
  assert.deepEqual(readHistory(local)[0], legacy);
});

test('같은 위치의 서로 다른 업종 예측을 함께 보관', () => {
  const first = candidate('s1');
  const second = { ...first, id: 's2', industry: 'korean', sales: 34000000 };
  const saved = addCandidate([first], second);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].sales, 28000000);
  assert.equal(saved[1].sales, 34000000);
  assert.equal(comparisonEntries(saved, { industry: 'chicken', mock: true }).length, 2);
});
