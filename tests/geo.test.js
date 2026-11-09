import test from 'node:test';
import assert from 'node:assert/strict';
import { withinDemoBounds, withinGeoJSON } from '../src/lib/geo.js';

test('임시 사각형: 경계선은 내부로 처리', () => {
  assert.equal(withinDemoBounds(37.350, 126.895), true);
  assert.equal(withinDemoBounds(37.440, 126.995), true);
  assert.equal(withinDemoBounds(37.449, 126.95), false);
});

// 전부 테스트용 사각형, 실제 안양시 경계와는 무관
const polygon = { type:'Polygon', coordinates:[
  [[0,0],[10,0],[10,10],[0,10],[0,0]],
  [[3,3],[7,3],[7,7],[3,7],[3,3]],
]};

test('GeoJSON: 외곽 안/밖 및 경계 포함', () => {
  assert.equal(withinGeoJSON(1,1,polygon),true);
  assert.equal(withinGeoJSON(0,10,polygon),true);
  assert.equal(withinGeoJSON(11,1,polygon),false);
});
test('GeoJSON: 구멍 내부는 제외, 구멍 경계는 포함', () => {
  assert.equal(withinGeoJSON(5,5,polygon),false);
  assert.equal(withinGeoJSON(3,5,polygon),true);
});
test('GeoJSON: FeatureCollection 및 MultiPolygon', () => {
  const multipart = {type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'MultiPolygon',coordinates:[
      [[[100,100],[102,100],[102,102],[100,102],[100,100]]],
      polygon.coordinates,
    ]}},
  ]};
  assert.equal(withinGeoJSON(1,1,multipart),true);
  assert.equal(withinGeoJSON(101,101,multipart),true);
  assert.equal(withinGeoJSON(50,50,multipart),false);
});
