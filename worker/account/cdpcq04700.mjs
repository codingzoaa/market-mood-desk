import {check} from './security.mjs';
/** User-provided public catalog export. Structural fields verified; ledger semantics are separate. */
export const CDPCQ04700=Object.freeze({mode:'CDPCQ04700_LEDGER_V1',reviewed:true,tr:'CDPCQ04700',version:'8d1dbe291a94e08661c5cd30d19a6267416be7bf4b8787e7c3c2224bd7bb78d8',documentId:'819f29badcdddce05dd9fa26e6a03302e15b98a52cfbc4a7e84c4659fed71d32',documentationURL:'https://openapi.ls-sec.co.kr/api/apis/public/assistant/tr?product=openapi&code=CDPCQ04700',rowsBlock:'CDPCQ04700OutBlock3',maxRequestsPerSecond:1,maxRangeDays:1,pageLimit:100});
export function ledgerRequest(job){
 check(/^\d{4}-\d{2}-\d{2}$/.test(job.from)&&job.from===job.to,'INVALID_LEDGER_RANGE');
 // RecCnt describes the input record, NOT an undocumented page-size parameter.
 // SrtNo is not inferred from TrdNo. Only the documented response header is echoed.
 return {CDPCQ04700InBlock1:{RecCnt:1,QryTp:'0',QrySrtDt:job.from.replaceAll('-',''),QryEndDt:job.to.replaceAll('-',''),SrtNo:0,PdptnCode:'01',IsuLgclssCode:'01',IsuNo:''}};
}
const textFields={TrdDt:8,TpCodeNm:50,SmryNo:4,SmryNm:40,CancTpNm:20,IsuNm:40,TrxTime:9,IsuNo:12,CrcyCode:3,OrdDt:8,LoanDt:8};
const numberFields=['TrdNo','OrgTrdNo','TrdQty','TrdUprc','TrdAmt','CmsnAmt','Trtax','TaxSumAmt','EvrTax','Ictax','Ihtax','AdjstAmt','SecCrbalQty','BnsplAmt','MnyDvdAmt','FcurrTrdAmt','FcurrCmsnAmt','FcurrTaxSumAmt','RdctCmsn','LoanIntrstAmt','RcvblOcrAmt'];
export function decimal(value){
 check(typeof value==='string'||typeof value==='number'&&Number.isFinite(value)&&(Number.isSafeInteger(value)||Math.abs(value)<1e12),'INVALID_LEDGER_NUMBER');
 const s=String(value);check(/^-?\d{1,25}(?:\.\d{1,4})?$/.test(s),'INVALID_LEDGER_NUMBER');
 const [whole,fraction='']=s.split('.'),negative=whole.startsWith('-'),digits=whole.replace('-','').replace(/^0+(?=\d)/,''),tail=fraction.replace(/0+$/,'');
 return (negative&&(digits!=='0'||tail)?'-':'')+digits+(tail?'.'+tail:'');
}
export function normalizeLedgerRow(row,env){
 check(row&&typeof row==='object'&&!Array.isArray(row),'INVALID_LEDGER_ROW');
 check(typeof env.LS_ACCOUNT_NO==='string'&&env.LS_ACCOUNT_NO.length>0&&row.AcntNo===env.LS_ACCOUNT_NO,'LEDGER_ACCOUNT_MISMATCH');
 const fields={};
 for(const [name,max] of Object.entries(textFields))if(row[name]!==undefined){check(row[name]===null||typeof row[name]==='string'&&row[name].length<=max,'INVALID_LEDGER_TEXT');fields[name]=row[name];}
 for(const name of numberFields)if(row[name]!==undefined)fields[name]=row[name]===null||row[name]===''?row[name]:decimal(row[name]);
 check(/^\d{8}$/.test(fields.TrdDt)&&/^\d{1,10}$/.test(fields.TrdNo||''),'LEDGER_ID_MISSING');
 const date=fields.TrdDt.slice(0,4)+'-'+fields.TrdDt.slice(4,6)+'-'+fields.TrdDt.slice(6);check(new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'INVALID_LEDGER_DATE');
 // Drop echoed passwords, counterpart accounts/names, OAuth, unknown attributes and summaries.
 return {source:'LS:CDPCQ04700',contractVersion:CDPCQ04700.version,accountRef:env.LS_ACCOUNT_NO,date,id:fields.TrdNo,fields};
}
export function readLedgerRules(env){
 if(!env.LS_LEDGER_RULES)return null;
 let r;try{r=JSON.parse(env.LS_LEDGER_RULES);}catch{throw Error('INVALID_LEDGER_RULES');}
 check(r?.reviewed===true&&typeof r.version==='string'&&r.version.length>0&&r.version.length<=100&&r.ordering==='TRD_NO_ASC'&&r.processedTimeFormat==='HHmmssSSS'&&r.taxSemanticsReviewed===true&&['KRX_6','A_PREFIXED_KRX_6'].includes(r.symbology)&&Array.isArray(r.rules)&&r.rules.length>0&&r.rules.length<=100,'INVALID_LEDGER_RULES');
 check(Array.isArray(r.taxFields)&&r.taxFields.length>0&&new Set(r.taxFields).size===r.taxFields.length&&r.taxFields.every(k=>['Trtax','TaxSumAmt','EvrTax','Ictax','Ihtax'].includes(k)),'INVALID_LEDGER_TAX_RULE');
 const seen=new Set();for(const rule of r.rules){check(['BUY','SELL','DEPOSIT','WITHDRAWAL'].includes(rule.side)&&['TpCodeNm','SmryNo','SmryNm','CancTpNm','CrcyCode'].every(k=>typeof rule[k]==='string')&&rule.CrcyCode==='KRW','INVALID_LEDGER_RULE');const key=JSON.stringify(['TpCodeNm','SmryNo','SmryNm','CancTpNm','CrcyCode'].map(k=>rule[k]));check(!seen.has(key),'DUPLICATE_LEDGER_RULE');seen.add(key);}return r;
}
function integer(value){check(typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)),'LEDGER_AMOUNT_REVIEW_REQUIRED');return Number(value);}
export function ledgerToTrade(row,rules){
 if(!rules)return {issue:'CLASSIFICATION_REQUIRED'};
 const f=row.fields,rule=rules.rules.find(r=>['TpCodeNm','SmryNo','SmryNm','CancTpNm','CrcyCode'].every(k=>f[k]===r[k]));
 if(!rule)return {issue:'CLASSIFICATION_REQUIRED'};
 try{
  check(f.OrgTrdNo==='0'&&(!f.LoanDt||f.LoanDt==='00000000'),'ADJUSTMENT_REVIEW_REQUIRED');
  if(['DEPOSIT','WITHDRAWAL'].includes(rule.side)){
   check(f.IsuNo===''&&integer(f.TrdQty)===0&&integer(f.CmsnAmt)===0&&rules.taxFields.every(k=>integer(f[k])===0)&&(!f.MnyDvdAmt||f.MnyDvdAmt==='0'),'ADJUSTMENT_REVIEW_REQUIRED');const amountKRW=integer(f.TrdAmt);check(amountKRW>0,'LEDGER_AMOUNT_REVIEW_REQUIRED');
   return {cashMovement:{side:rule.side,amountKRW}};
  }
  check(/^\d{9}$/.test(f.TrxTime||''),'PROCESSING_TIME_REVIEW_REQUIRED');const h=Number(f.TrxTime.slice(0,2)),m=Number(f.TrxTime.slice(2,4)),s=Number(f.TrxTime.slice(4,6));check(h<24&&m<60&&s<60,'PROCESSING_TIME_REVIEW_REQUIRED');
  const symbol=rules.symbology==='A_PREFIXED_KRX_6'&&/^A[0-9A-Z]{6}$/.test(f.IsuNo)?f.IsuNo.slice(1):rules.symbology==='KRX_6'?f.IsuNo:null;
  check(/^[0-9A-Z]{6}$/.test(symbol||'')&&f.IsuNm,'SYMBOL_REVIEW_REQUIRED');
  const quantity=integer(f.TrdQty),grossKRW=integer(f.TrdAmt),feeKRW=integer(f.CmsnAmt),taxKRW=rules.taxFields.reduce((sum,k)=>sum+integer(f[k]),0),price=Number(f.TrdUprc);
  check(quantity>0&&grossKRW>0&&Number.isFinite(price)&&price>0&&price<=1e9&&Number.isSafeInteger(taxKRW)&&feeKRW+taxKRW<=grossKRW,'LEDGER_AMOUNT_REVIEW_REQUIRED');
  // Ledger prices may be averages (13.2); authoritative TrdAmt is never reconstructed.
  return {trade:{id:row.id,accountRef:row.accountRef,date:row.date,time:f.TrxTime.slice(0,2)+':'+f.TrxTime.slice(2,4)+':'+f.TrxTime.slice(4,6),sequence:integer(f.TrdNo),symbol,name:f.IsuNm,side:rule.side,quantity,price,grossKRW,feeKRW,taxKRW,orderingBasis:'LEDGER_SEQUENCE'}};
 }catch(error){return {issue:['ADJUSTMENT_REVIEW_REQUIRED','PROCESSING_TIME_REVIEW_REQUIRED','SYMBOL_REVIEW_REQUIRED'].includes(error.message)?error.message:'LEDGER_AMOUNT_REVIEW_REQUIRED'};}
}
