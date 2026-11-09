import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowRight, BarChart3, BookmarkPlus, CheckCircle2, ChevronDown, Coffee, Compass, Lightbulb, LoaderCircle, MapPin, Navigation, RotateCcw, SlidersHorizontal, Sparkles, TrendingUp, UsersRound, X
} from 'lucide-react';
import './terminal-theme.css';
import './studio.css';
import AnyangMap from './components/AnyangMap.jsx';
import { analyzeLocation, generateReport, IS_MOCK } from './services/api.js';
import {
  INDUSTRIES, RADII, formatWonToManwon, displayMoney, optionalMetric,
} from './lib/contracts.js';
import { PRESET_LOCATIONS, nearestPreset, withinDemoBounds, withinGeoJSON } from './lib/geo.js';
import {
  MAX_COMPARISONS, addCandidate, comparisonEntries, readHistory, samePlace, writeHistory,
} from './lib/history.js';
import { COMPARISON_METRICS, scoreCandidates } from './lib/comparison.js';

// 브라우저 저장: 서버 없이 프론트엔드만으로 후보지 비교가 가능하도록 설계함.
let storage = null;
try {
  storage = typeof window === 'undefined' ? null : window.sessionStorage;
} catch {
  // 저장 공간 접근이 제한되어도 현재 화면의 비교 목록은 사용할 수 있습니다.
}
const DEMO_SCENARIOS = [
  { value: 'success', label: '정상 응답' },
  { value: 'slow', label: '느린 응답 (2.4초)' },
  { value: 'data_unavailable', label: '데이터 없음' },
  { value: 'model_unavailable', label: '모델 오류' },
  { value: 'server_error', label: '서버 오류' },
  { value: 'invalid_response', label: '잘못된 JSON 형식' },
  { value: 'report_error', label: 'GPT 리포트 오류' },
];

function MetricCard({ icon: Icon, tint, label, value, unit = '', caption }) {
  const unavailable = value === '자료 없음';
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${tint}`}><Icon size={19} /></span>
        <span className="metric-caption">{caption}</span>
      </div>
      <p className="metric-label">{label}</p>
      <div className={`metric-value ${unavailable ? 'unavailable' : ''}`}>
        {value}<small>{unavailable ? '' : unit}</small>
      </div>
    </article>
  );
}

function comparisonLabel(item) {
  const name = INDUSTRIES.find(industry => industry.code === item.industry)?.label || item.industry;
  return `${name} · ${item.label} · ${item.radius_m}m`;
}

function ComparisonOverview({ entries }) {
  if (!entries.length) {
    return (
      <div className="comparison-empty">
        <BarChart3 size={26} />
        <strong>저장한 후보지가 없어요.</strong>
        <p>위치를 분석한 다음 '비교 목록에 추가'을 눌러 주세요.</p>
      </div>
    );
  }
  const scored = scoreCandidates(entries);
  const formatValue = (key, value) => {
    if (key === 'sales') return displayMoney(value);
    if (key === 'foot_traffic') return `${Number(value).toLocaleString('ko-KR')}명`;
    return `${Number(value).toLocaleString('ko-KR')}점`;
  };
  return (
    <div className="comparison-dashboard" aria-label="후보지 종합 평가와 지표 비교">
      <section className="comparison-overall" aria-labelledby="comparison-overall-title">
        <div className="comparison-section-heading">
          <div><span className="comparison-section-kicker">SUMMARY</span>
            <h3 id="comparison-overall-title">종합 평가</h3></div>
          <p>비교 후보 안에서 각 지표를 100점 기준으로 환산해 동일 비중으로 계산</p>
        </div>
        <div className="comparison-score-cards">
          {scored.map(({ item, score, dataCount }, index) => (
            <article className="comparison-score-card" key={item.id}>
              <div className="comparison-score-place">
                <span className={`rank-bubble rank-${index}`}>{String.fromCharCode(65 + index)}</span>
                <div><strong>{item.label}</strong>
                  <span>{INDUSTRIES.find(option => option.code === item.industry)?.label || item.industry} · {item.radius_m}m</span></div>
              </div>
              <div className="comparison-score-value">
                <strong>{score === null ? '—' : score}</strong><span>{score === null ? '점수 산출 불가' : '/ 100점'}</span>
              </div>
              <div className="comparison-score-track" aria-hidden="true">
                <span style={{ width: `${score ?? 0}%` }} />
              </div>
              <span className="comparison-data-count">데이터 {dataCount} / {COMPARISON_METRICS.length}개</span>
            </article>
          ))}
        </div>
      </section>
      <section className="comparison-detail" aria-labelledby="comparison-detail-title">
        <div className="comparison-section-heading">
          <div><span className="comparison-section-kicker">DETAILS</span>
            <h3 id="comparison-detail-title">세부 지표</h3></div>
          <p>막대는 해당 지표에서 비교 후보 중 최대값을 기준으로 표시</p>
        </div>
        <div className="comparison-table-scroll">
          <table className="comparison-table">
            <thead><tr><th scope="col">비교 항목</th>
              {entries.map(item => <th scope="col" key={item.id}>
                <span>{item.label}</span>
                <small>{INDUSTRIES.find(option => option.code === item.industry)?.label || item.industry} · {item.radius_m}m</small>
              </th>)}
            </tr></thead>
            <tbody>{COMPARISON_METRICS.map(metric => {
              const maximum = Math.max(0, ...entries.map(item => {
                const value = item[metric.key];
                return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
              }));
              return <tr key={metric.key}>
                <th scope="row">{metric.label}<small>{metric.unit}</small></th>
                {entries.map((item, index) => {
                  const value = item[metric.key];
                  const available = typeof value === 'number' && Number.isFinite(value) && value >= 0;
                  const percent = available && maximum > 0 ? value / maximum * 100 : 0;
                  return <td key={item.id}>
                    <strong className={available ? '' : 'unavailable'}>{available ? formatValue(metric.key, value) : '자료 없음'}</strong>
                    <div className="comparison-table-track" aria-hidden="true">
                      {available && <span className={`comparison-fill comparison-color-${index}`} style={{ width: `${percent}%` }} />}
                    </div>
                  </td>;
                })}
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Toast({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`toast toast-${notice.type}`} role="status" aria-live="polite">
      {notice.type === 'error' ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
      <span>{notice.message}</span>
      <button className="icon-button" type="button" onClick={onClose} aria-label="알림 닫기">
        <X size={17} />
      </button>
    </div>
  );
}

export default function App() {
  const [industry, setIndustry] = useState('cafe');
  const [radius, setRadius] = useState(500);
  const [selected, setSelected] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisContext, setAnalysisContext] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [reportError, setReportError] = useState('');
  const [notice, setNotice] = useState(null);
  const [history, setHistory] = useState(() => readHistory(storage));
  const [showComparison, setShowComparison] = useState(false);
  const [boundary, setBoundary] = useState(null);
  const [boundaryState, setBoundaryState] = useState('loading');
  const [showReport, setShowReport] = useState(false);
  const [scenario, setScenario] = useState('success');

  const analysisController = useRef(null);
  const reportController = useRef(null);
  const analysisRequestNumber = useRef(0);
  const reportRequestNumber = useRef(0);
  const mapRef = useRef(null);
  const resultRef = useRef(null);
  const panelContentRef = useRef(null);
  const comparisonRef = useRef(null);
  const reportDialogRef = useRef(null);

  const industryName = INDUSTRIES.find(item => item.code === industry)?.label || industry;
  const comparisonMockMode = analysis ? analysis.mock : IS_MOCK;
  const storedForCurrent = comparisonEntries(history, {
    industry, radius_m: radius, mock: comparisonMockMode,
  });
  const currentSavedCheck = analysisContext ? {
    industry: analysisContext.industry,
    radius_m: analysisContext.radius_m,
    latitude: analysisContext.location.lat,
    longitude: analysisContext.location.lng,
    mock: Boolean(analysis?.mock),
  } : null;
  const alreadySaved = currentSavedCheck && history.some(item => samePlace(item, currentSavedCheck));

  // 안양시 GeoJSON이 제공되면 정확한 경계로 판정합니다. 없을 때는 데모 범위를 표시합니다.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}boundary/anyang.geojson`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('행정구역 파일 없음');
        return response.json();
      })
      .then(data => {
        if (!data?.type || !PRESET_LOCATIONS.some(p => withinGeoJSON(p.lat, p.lng, data))) {
          throw new Error('유효한 안양시 경계 파일이 아닙니다');
        }
        setBoundary(data);
        setBoundaryState('ready');
      })
      .catch(error => { if (error.name !== 'AbortError') setBoundaryState('missing'); });
    return () => controller.abort();
  }, []);

  useEffect(() => { writeHistory(storage, history); setShowComparison(false); }, [history]);

  useEffect(() => {
    const dialog = comparisonRef.current;
    if (showComparison && !dialog.open) dialog.showModal();
    if (!showComparison && dialog.open) dialog.close();
  }, [showComparison]);

  useEffect(() => {
    const dialog = reportDialogRef.current;
    if (showReport && !dialog.open) dialog.showModal();
    if (!showReport && dialog.open) dialog.close();
  }, [showReport]);

  // 필터가 바뀌면 이전 응답을 받더라도 결과가 덮어쓰이지 않게 즉시 취소합니다.
  function cancelPending() {
    analysisRequestNumber.current += 1;
    reportRequestNumber.current += 1;
    analysisController.current?.abort();
    reportController.current?.abort();
    setLoading(false);
    setReportLoading(false);
  }

  useEffect(() => () => {
    analysisController.current?.abort();
    reportController.current?.abort();
  }, []);

  function invalidateResults() {
    setShowReport(false);
    cancelPending();
    setAnalysis(null);
    setAnalysisContext(null);
    setReport(null);
    setAnalysisError('');
    setReportError('');
  }

  function notify(message, type = 'error') { setNotice({ type, message }); }

  function selectPoint(lat, lng, providedName) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const valid = boundary ? withinGeoJSON(lat, lng, boundary) :
      (IS_MOCK ? withinDemoBounds(lat, lng) : true);
    if (!valid) {
      notify(boundary ? '안양시 행정구역 밖입니다. 안양시 내부를 선택해 주세요.' :
        '시제품 테스트 범위 밖입니다. 점선 안쪽을 선택해 주세요.');
      return;
    }
    invalidateResults();
    setSelected({ lat, lng, name: providedName || nearestPreset(lat, lng) });
    setNotice(null);
  }

  function changeIndustry(value) {
    invalidateResults();
    setIndustry(value);
  }

  function changeRadius(value) {
    invalidateResults();
    setRadius(value);
  }

  async function handleAnalyze() {
    if (!selected || loading) {
      if (!selected) notify('먼저 지도에서 분석할 위치를 선택해 주세요.');
      return;
    }
    reportController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    const currentRequest = ++analysisRequestNumber.current;
    const context = { industry, radius_m: radius, location: { ...selected } };
    setAnalysis(null);
    setReport(null);
    setReportError('');
    setAnalysisError('');
    setNotice(null);
    setLoading(true);
    try {
      const result = await analyzeLocation({
        industry, latitude: selected.lat, longitude: selected.lng, radius_m: radius,
      }, { signal: controller.signal, scenario });
      if (currentRequest !== analysisRequestNumber.current) return;
      setAnalysis(result);
      setAnalysisContext(context);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      if (controller.signal.aborted || currentRequest !== analysisRequestNumber.current) return;
      setAnalysisError(error.message || '분석 요청에 실패했습니다.');
    } finally {
      if (currentRequest === analysisRequestNumber.current) setLoading(false);
    }
  }

  async function handleReport() {
    if (!analysis || !analysisContext || reportLoading) return;
    const controller = new AbortController();
    reportController.current = controller;
    const currentRequest = ++reportRequestNumber.current;
    setReportError('');
    setReportLoading(true);
    try {
      const result = await generateReport({
        analysis,
        industry: analysisContext.industry,
        location: analysisContext.location,
      }, { signal: controller.signal, scenario });
      if (currentRequest !== reportRequestNumber.current) return;
      setReport(result);
    } catch (error) {
      if (controller.signal.aborted || currentRequest !== reportRequestNumber.current) return;
      setReportError(error.message || '리포트 생성에 실패했습니다.');
    } finally {
      if (currentRequest === reportRequestNumber.current) setReportLoading(false);
    }
  }

  function saveCandidate() {
    if (!analysis || !analysisContext) return;
    const { location, industry: analyzedIndustry, radius_m } = analysisContext;
    const next = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
      label: location.name === '지도에서 선택한 위치' ?
        `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : location.name,
      industry: analyzedIndustry, radius_m,
      latitude: location.lat, longitude: location.lng,
      sales: analysis.predicted_monthly_sales_krw,
      foot_traffic: analysis.estimated_daily_foot_traffic,
      accessibility_score: analysis.accessibility_score,
      mock: Boolean(analysis.mock),
      model_name: analysis.model_name,
      analysis_level: analysis.analysis_level,
      saved_at: new Date().toISOString(),
    };
    try {
      const nextHistory = addCandidate(history, next);
      setHistory(nextHistory);
      notify('비교 목록에 추가했어요. 다른 업종도 예측한 뒤 비교하기를 눌러 주세요.', 'success');
    } catch (error) {
      notify(error.message);
    }
  }

  function resetFilters() {
    invalidateResults();
    setIndustry('cafe');
    setRadius(500);
    setSelected(null);
    setNotice(null);
    panelContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }


  return (
    <div className="studio-shell">
      <header className="studio-header">
        <a className="brand" href="#home" aria-label="밀당 처음으로">밀당</a>
        <div className="studio-product"><span /> 입지 분석 스튜디오</div>
        <div className="studio-header-right">
          <span className="studio-region"><MapPin size={14} /> 안양시</span>
        </div>
      </header>
      <main className="studio-workspace" id="home">
        <section className="studio-map" aria-label="안양시 위치 선택 지도" ref={mapRef}>
          <AnyangMap selected={selected} radius={radius} boundary={boundary} onSelect={selectPoint} />
        </section>
        <aside className="studio-panel" aria-label="분석 조건과 결과">
          <div className="studio-panel-title">
            <span className="studio-eyebrow">LOCATION / INSIGHT</span>
            <h1>어디에 열어볼까요?</h1>
            <p>업종을 고르고 지도에서 가능성을 찾아보세요.</p>
            {analysis && <button type="button" className="studio-edit"
              onClick={() => panelContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <SlidersHorizontal size={13} /> 조건 수정
            </button>}
          </div>
          <div className="studio-panel-content" ref={panelContentRef}>
            <div className="field-group">
              <label htmlFor="business">창업 업종 <span className="required">*</span></label>
              <div className="input-wrap"><Coffee size={18} className="field-icon" />
                <select id="business" value={industry} onChange={event => changeIndustry(event.target.value)}>
                  {INDUSTRIES.map(option => <option value={option.code} key={option.code}>{option.label}</option>)}
                </select><ChevronDown size={17} className="field-chevron" />
              </div>
              <small className="field-help">업종별 예상 매출을 비교해 보세요.</small>
            </div>
            <div className="field-group">
              <label>분석 지역 <span className="required">*</span></label>
              <div className="fixed-input"><MapPin size={17} /><span>경기도 안양시</span>
                <span className="fixed-badge">시범 지역</span></div>
            </div>
            <div className="field-group">
              <div className="field-label-row"><label>상권 분석 반경</label></div>
              <div className="radius-options" aria-label="상권 분석 반경">
                {RADII.map(value => <button key={value} type="button"
                  className={radius === value ? 'selected' : ''}
                  aria-pressed={radius === value}
                  onClick={() => changeRadius(value)}>{value === 1000 ? '1km' : `${value}m`}</button>)}
              </div>
              <small className="field-help">선택 위치를 중심으로 살펴볼 범위입니다.</small>
            </div>
            <div className="field-group quick-locations"><label>빠른 위치 선택</label>
              <div className="quick-location-grid">
                {PRESET_LOCATIONS.map(place => <button type="button" key={place.name}
                  className={selected?.name === place.name ? 'quick-place active' : 'quick-place'}
                  onClick={() => selectPoint(place.lat, place.lng, place.name)}>
                  <MapPin size={13} />{place.name}</button>)}
              </div>
            </div>
            <div className="selected-summary">
              <span className="selected-summary-icon"><Navigation size={16} /></span>
              <div><small>현재 선택 위치</small><strong>{selected?.name || '지도에서 선택해 주세요'}</strong>
                <span className="coords">{selected ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : '선택된 위치 없음'}</span>
              </div>{selected && <CheckCircle2 size={17} className="selected-check" />}
            </div>
            {IS_MOCK && <details className="dev-panel">
              <summary>데모 응답 설정</summary>
              <label htmlFor="scenario">테스트할 서버 응답</label>
              <select id="scenario" value={scenario} onChange={e => setScenario(e.target.value)}>
                {DEMO_SCENARIOS.map(test => <option key={test.value} value={test.value}>{test.label}</option>)}
              </select>
              <p>선택 후 위의 '예상 월매출 예측하기'를 눌러 오류 표시를 확인하세요.</p>
            </details>}

            {(analysis || loading || analysisError) && <section className="studio-result" aria-label="매출 예측 결과" ref={resultRef} aria-live="polite">
          {analysisError && <div className="inline-error" role="alert"><AlertCircle size={19} />
            <div><strong>분석에 실패했습니다.</strong><p>{analysisError}</p></div>
            <button type="button" onClick={handleAnalyze}>다시 시도</button></div>}
          {loading && <div className="loading-state"><LoaderCircle size={28} className="spinner" /> 분석 결과를 불러오고 있어요.</div>}
          {analysis && analysisContext ? <>
            <div className="result-headline-card">
              <div className="result-title-area"><div className="result-title-icon"><TrendingUp size={24} /></div>
                <div><span className="result-kicker">MONTHLY SALES ESTIMATE</span>
                  <h3>{analysisContext.location.name} <span>· {industryName}</span></h3>
                  <p>{analysis.analysis_level} · {analysisContext.radius_m}m 분석 설정</p>
                </div>
              </div>
              <div className="result-number-area"><div><span>예상 월매출 <span className="fake-tag">{analysis.mock ? '가상값' : '모델 결과'}</span></span>
                <div className="headline-number">{formatWonToManwon(analysis.predicted_monthly_sales_krw)} <small>만원</small></div>
              </div>
                <button className={`outline-save ${alreadySaved ? 'saved' : ''}`} type="button"
                  disabled={alreadySaved || storedForCurrent.length >= MAX_COMPARISONS}
                  onClick={saveCandidate}><BookmarkPlus size={17} />
                  {alreadySaved ? '저장됨' : storedForCurrent.length >= MAX_COMPARISONS ? '저장 한도 3개' : '비교 목록에 추가'}
                </button>
              </div>
            </div>
            <div className="metrics-grid">
              <MetricCard icon={UsersRound} tint="blue" label="주변 경쟁업체"
                value={optionalMetric(analysis.competitor_count)} unit="개" caption="선택 반경 기준" />
              <MetricCard icon={Activity} tint="violet" label="일평균 유동인구"
                value={optionalMetric(analysis.estimated_daily_foot_traffic)} unit="명" caption="데이터 있을 때 표시" />
              <MetricCard icon={Compass} tint="green" label="접근성 지수"
                value={optionalMetric(analysis.accessibility_score)} unit="/ 100" caption="데이터 있을 때 표시" />
            </div>
            <div className="result-disclaimer"><AlertCircle size={16} />
              {analysis.mock ? '실제 지역 통계나 학습된 AI 모델의 예측이 아닙니다. 창업 판단에 사용하지 마세요.' :
                `모델: ${analysis.model_name}. 예측의 의미와 한계는 모델 팀이 제공한 설명을 확인하세요.`}
            </div>
          </> : null}

              {analysis && <button className="studio-report-link" type="button" onClick={() => setShowReport(true)}>
                창업 전략 리포트 열기 <ArrowRight size={15} />
              </button>}
            </section>}
          </div>
          <div className="studio-panel-actions">
            <button className="primary-button" disabled={!selected || loading} type="button"
              onClick={handleAnalyze} aria-busy={loading}>
              {loading ? <><LoaderCircle size={18} className="spinner" /> 분석 중...</> :
                <><TrendingUp size={18} /> 매출 예측하기 <ArrowRight size={17} /></>}
            </button>
            <button className="reset-button" type="button" onClick={resetFilters}>
              <RotateCcw size={15} /> 조건 초기화</button>
          </div>
        </aside>
        <p className="studio-map-hint">지도를 움직여 위치를 찾고 클릭해 선택해보세요.</p>
        <section className="studio-tray" aria-label="비교할 예측 결과">
          <div className="studio-tray-heading"><span>COMPARE</span><strong>비교 목록 <small>{storedForCurrent.length} / {MAX_COMPARISONS}</small></strong></div>
          <div className="studio-tray-items">
            {storedForCurrent.length === 0 && <div className="studio-tray-empty">예측 결과를 담아보세요.<span>다른 업종의 가능성을 한눈에 비교할 수 있어요.</span></div>}
            {storedForCurrent.map((item, index) => <article className="studio-tray-item" key={item.id}>
              <span className="studio-item-index">{String(index + 1).padStart(2, '0')}</span>
              <div><strong>{INDUSTRIES.find(option => option.code === item.industry)?.label || item.industry}</strong>
                <span title={comparisonLabel(item)}>{item.label} · {item.radius_m}m</span>
                <b>{displayMoney(item.sales)}</b></div>
              <button type="button" className="studio-icon-button" aria-label={`${comparisonLabel(item)} 삭제`}
                onClick={() => setHistory(current => current.filter(saved => saved.id !== item.id))}><X size={14} /></button>
            </article>)}
          </div>
          <button className="studio-compare-button" type="button" disabled={storedForCurrent.length < 2}
            onClick={() => setShowComparison(true)}><BarChart3 size={17} /> 비교하기 <ArrowRight size={16} /></button>
        </section>
      </main>
      <dialog className="studio-drawer" aria-label="후보지 지표 비교" ref={comparisonRef} onCancel={() => setShowComparison(false)} onClose={() => setShowComparison(false)}>
        <div className="studio-drawer-head"><div><span className="studio-eyebrow">SIDE BY SIDE</span><h2>가능성을 비교하세요.</h2>
          <p>예상 월매출 · 일평균 유동인구 · 접근성 지수 · {storedForCurrent.length}개 결과</p></div>
          <button className="studio-icon-button" type="button" onClick={() => setShowComparison(false)} aria-label="비교 닫기"><X size={22} /></button></div>
        <ComparisonOverview entries={storedForCurrent} />
        <p className="studio-drawer-note">{comparisonMockMode ? '시연용 가상 수치입니다.' : '모델 예측 결과입니다.'} 종합 점수는 현재 비교 후보에 따라 달라지는 상대 점수이며, 데이터가 없는 지표는 평균에서 제외됩니다. 데이터 개수도 함께 확인해 주세요.</p>
      </dialog>
      <dialog className="studio-drawer studio-report-drawer" aria-label="창업 전략 리포트" ref={reportDialogRef} onCancel={() => setShowReport(false)} onClose={() => setShowReport(false)}>
        <button className="studio-icon-button studio-report-close" type="button" onClick={() => setShowReport(false)} aria-label="리포트 닫기"><X size={22} /></button>
          <section className="ai-card">
            <div className="lower-card-head"><div className="small-card-icon violet-icon"><Sparkles size={20} /></div>
              <div className="lower-card-titles"><h3>AI 창업 전략 리포트</h3>
                <p>매출 분석 후 별도 요청으로 생성합니다.</p></div>
              <span className="small-badge purple">{IS_MOCK ? '샘플 응답' : 'GPT API'}</span></div>
            {report ? <div className="report-content">
              <div className="report-line"><span className="report-dot positive" /><div><strong>강점</strong><p>{report.strengths}</p></div></div>
              <div className="report-line"><span className="report-dot caution" /><div><strong>위험 요인</strong><p>{report.risks}</p></div></div>
              <div className="report-line"><span className="report-dot blue" /><div><strong>추천 전략</strong><p>{report.strategy}</p></div></div>
              <div className="report-fake-note">{report.mock ? 'GPT 호출 없이 생성된 테스트 문장입니다.' : '백엔드 리포트 결과'}</div>
            </div> : <div className="ai-placeholder"><div className="ai-placeholder-icon"><Lightbulb size={30} /></div>
              <h4>이 입지에서 창업해도 괜찮을까?</h4>
              <p>분석 결과를 바탕으로 입지의 강점과<br /> 주의할 점을 정리해 드려요.</p>
            </div>}
            {reportError && <p className="report-error" role="alert">{reportError}</p>}
            <button className="ai-button" type="button" disabled={!analysis || reportLoading}
              aria-busy={reportLoading} onClick={handleReport}>
              {reportLoading ? <><LoaderCircle size={17} className="spinner" /> 리포트 생성 중...</> :
                <><Sparkles size={17} />{reportError ? '리포트 다시 시도' : report ? '리포트 다시 생성' : '리포트 생성하기'}<ArrowRight size={16} /></>}
            </button>
          </section>

      </dialog>
      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
