export function calendarPublicationOutcome(run,jobs=[]){
 if(run.name!=='Publish verified sector calendar at 17 KST'||run.status!=='completed')return null;
 const steps=jobs.flatMap(j=>j.steps||[]),success=name=>steps.some(s=>s.name===name&&s.conclusion==='success');
 const failed=steps.filter(s=>s.conclusion==='failure');
 if(run.conclusion==='failure'&&success('Calendar review awaiting verified inputs')&&failed.length===1&&failed[0].name==='Report publication result and expose verification failures')return 'pending';
 if(run.conclusion!=='success')return null;
 if(success('Calendar waiting for scheduled review time'))return 'waiting';
 if(success('Calendar review already published'))return 'unchanged';
 if(success('Deploy verified calendar to Pages'))return 'deployed';
 if(steps.some(s=>s.name==='Deploy verified calendar to Pages'&&s.conclusion==='skipped'))return 'no_deploy';
 return null;
}
export function operationState(r){
 if(!r)return '실행 기록 없음';
 if(r.status!=='completed')return '진행 중';
 if(r.conclusion==='failure'&&r.publicationStatus==='pending')return '자료 검증 보류';
 if(r.conclusion==='success')return ({waiting:'예약 대기',unchanged:'변경 없음',no_deploy:'배포 미실행',deployed:'발행·배포 완료'})[r.publicationStatus]||'성공';
 return ({skipped:'건너뜀',cancelled:'취소',action_required:'승인 대기'})[r.conclusion]||'실패';
}
export function publicationNote(r){if(r?.publicationStatus==='pending')return '당일 자료 또는 검증 조건을 충족하지 못했습니다. 미확인 리뷰는 발행하지 않으며, 배포·테스트 오류와 구분합니다.';return r?.conclusion==='success'?({waiting:'17:00 예정 시각 전 확인입니다. 발행·검증·배포 작업은 아직 실행하지 않았습니다.',unchanged:'이미 등록된 리뷰를 확인했습니다. 새 변경이 없어 PR·배포를 실행하지 않았습니다.',no_deploy:'이 실행은 새 발행·배포를 수행하지 않았습니다. 원문 실행 기록에서 예정 시각과 변경 여부를 확인할 수 있습니다.'})[r.publicationStatus]||null:null;}
