export type RotationState = '강화' | '둔화' | '회복' | '부진' | '중립';
export function rotationState(rs:number|null,previousRs:number|null,neutral=.1):RotationState|null {
 if(!Number.isFinite(neutral)||neutral<0)throw Error('INVALID_NEUTRAL_THRESHOLD');
 if(rs===null||previousRs===null||!Number.isFinite(rs)||!Number.isFinite(previousRs))return null;
 const delta=rs-previousRs;
 if(Math.abs(rs)<=neutral||Math.abs(delta)<=neutral)return '중립';
 return rs>0?(delta>0?'강화':'둔화'):(delta>0?'회복':'부진');
}
