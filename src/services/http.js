import { ApiError } from '../lib/contracts.js';

const ERROR_MESSAGES = {
  OUTSIDE_ANYANG: '안양시 범위 밖입니다. 안양시 내부 위치를 선택해 주세요.',
  DATA_UNAVAILABLE: '이 위치에 대해 학습에 필요한 데이터가 없습니다. 다른 위치를 선택해 주세요.',
  UNSUPPORTED_INDUSTRY: '아직 지원하지 않는 업종입니다.',
  MODEL_UNAVAILABLE: '예측 모델을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  SERVER_ERROR: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
};

/**
 * 네트워크, 타임아웃, JSON 해석, 백엔드 오류 코드 처리.
 * fetchImpl을 주입할 수 있으므로 서버 없이도 단위 테스트가 가능합니다.
 */
export async function postJson(baseUrl, path, payload, {
  signal, timeoutMs = 15000, fetchImpl = fetch,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status === 'error') {
      const code = typeof body?.error_code === 'string' ? body.error_code : 'HTTP_ERROR';
      const message = ERROR_MESSAGES[code] || body?.message || `서버 요청에 실패했습니다. (HTTP ${response.status})`;
      throw new ApiError(message, code, response.status);
    }
    if (!body) throw new ApiError('서버에서 JSON 형식의 결과를 받지 못했습니다.', 'INVALID_RESPONSE');
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError('요청 시간이 초과되었습니다. 네트워크나 서버 상태를 확인해 주세요.', 'TIMEOUT');
    if (signal?.aborted) throw new DOMException('요청 취소', 'AbortError');
    throw new ApiError('백엔드와 연결할 수 없습니다. 서버 주소와 실행 상태를 확인해 주세요.', 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
