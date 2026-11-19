export function qualitySummary(rows:any[],field:string,status='observed',source='원본 관측 자료'){
 const valid=rows.filter(r=>typeof r[field]==='number'&&Number.isFinite(r[field]));
 return {source,status,from:rows[0]?.date,to:rows.at(-1)?.date,count:rows.length,valid:valid.length,missing:rows.length-valid.length,lastValid:valid.at(-1)?.date};
}
export default function DataQuality({rows,field,status='observed',source,scope}:{rows:any[];field:string;status?:string;source:string;scope?:string}){
 const q=qualitySummary(rows,field,status,source);return <div className={'data-quality '+(q.missing?'has-missing':'')} role="status" aria-label="데이터 신뢰도와 표본 범위"><strong>{status==='provisional'?'잠정 · 검증 전':status==='validated'?'검증 자료':'원본 관측 · 잠정 가능'}</strong><span>{q.from||'—'} ~ {q.to||'—'}</span><span>표본 {q.count.toLocaleString()}일 · 유효 {q.valid.toLocaleString()}일 · 결측 {q.missing}일</span><span>마지막 유효일 {q.lastValid||'없음'}</span>{scope&&<span>{scope}</span>}<small>출처: {source} · 결측 집계는 수신된 날짜의 값 기준이며, 미수신 거래일은 포함하지 않습니다.</small></div>;
}
