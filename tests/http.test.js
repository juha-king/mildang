import test from 'node:test';
import assert from 'node:assert/strict';
import { postJson } from '../src/services/http.js';

const jsonResponse=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('POST JSON 요청에 필드가 정확히 담김',async()=>{
  let called;
  const result=await postJson('http://localhost:8000','/api/analyze',{industry:'cafe'}, {
    fetchImpl:async(url,options)=>{called={url,options};return jsonResponse({status:'success'});},
  });
  assert.equal(called.url,'http://localhost:8000/api/analyze');
  assert.equal(called.options.method,'POST');
  assert.deepEqual(JSON.parse(called.options.body),{industry:'cafe'});
  assert.deepEqual(result,{status:'success'});
});
test('백엔드 오류 코드 매핑',async()=>{
  await assert.rejects(postJson('http://a','/api/analyze',{}, {
    fetchImpl:async()=>jsonResponse({status:'error',error_code:'OUTSIDE_ANYANG'},422),
  }),error=>error.code==='OUTSIDE_ANYANG' && error.status===422);
});
test('네트워크 오류 처리',async()=>{
  await assert.rejects(postJson('http://a','/api/analyze',{}, {
    fetchImpl:async()=>{throw new TypeError('Failed to fetch');},
  }),error=>error.code==='NETWORK_ERROR');
});
test('타임아웃 처리',async()=>{
  await assert.rejects(postJson('http://a','/api/analyze',{}, {
    timeoutMs:15,
    fetchImpl:async (_url, opts)=>new Promise((_resolve,reject)=>{
      opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));
    }),
  }),error=>error.code==='TIMEOUT');
});
test('사용자 취소는 오류 UI로 노출하지 않도록 AbortError',async()=>{
  const c=new AbortController();
  const pending=postJson('http://a','/api/analyze',{}, {
    signal:c.signal,
    fetchImpl:async (_url,opts)=>new Promise((_resolve,reject)=>{
      opts.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));
    }),
  });
  c.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
});
