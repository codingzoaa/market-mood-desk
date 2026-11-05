import {ledgerToTrade} from './cdpcq04700.mjs';
export const ORDINARY_MAPPING_VERSION='LS_ORDINARY_CASH_KRX_NXT_V1';
const text=v=>typeof v==='string'?v.trim():'';
/** Only the ordinary domestic cash trade labels verified in the owner's ledger UI. */
export function ordinaryLedgerToTrade(row){
 const f=row.fields||{},type=text(f.TpCodeNm),summary=text(f.SmryNm),match=/^보통(매수|매도)_(KRX|NXT)$/.exec(summary);
 if(!match||type!==match[1])return {issue:'CLASSIFICATION_REQUIRED'};
 const cancel=text(f.CancTpNm);if(!['','정상','정상거래','해당없음'].includes(cancel)||f.OrgTrdNo!=='0'||text(f.LoanDt)&&text(f.LoanDt)!=='00000000')return {issue:'ADJUSTMENT_REVIEW_REQUIRED'};
 const currency=text(f.CrcyCode);if(currency&&!['KRW','원화'].includes(currency)||['FcurrTrdAmt','FcurrCmsnAmt','FcurrTaxSumAmt'].some(k=>f[k]!==undefined&&f[k]!==null&&f[k]!==''&&Number(f[k])!==0))return {issue:'CURRENCY_REVIEW_REQUIRED'};
 const symbol=text(f.IsuNo),symbology=/^A[0-9A-Z]{6}$/.test(symbol)?'A_PREFIXED_KRX_6':/^[0-9A-Z]{6}$/.test(symbol)?'KRX_6':null;
 if(!symbology)return {issue:'SYMBOL_REVIEW_REQUIRED'};
 // TaxSumAmt is the catalog's "세금합계금액". Never add its components again.
 if(typeof f.TaxSumAmt!=='string'||!/^\d+$/.test(f.TaxSumAmt))return {issue:'TAX_TOTAL_REVIEW_REQUIRED'};
 if(['Trtax','EvrTax','Ictax','Ihtax'].some(k=>typeof f[k]==='string'&&/^\d+$/.test(f[k])&&Number(f[k])>Number(f.TaxSumAmt)))return {issue:'TAX_TOTAL_REVIEW_REQUIRED'};
 const fields={...f,TpCodeNm:type,SmryNm:summary,CancTpNm:cancel,CrcyCode:'KRW',IsuNo:symbol,IsuNm:text(f.IsuNm),LoanDt:text(f.LoanDt)};
 // Six-digit source processing time has seconds but no fractional digits.
 if(/^\d{6}$/.test(fields.TrxTime||''))fields.TrxTime+='000';
 const rules={symbology,taxFields:['TaxSumAmt'],rules:[{TpCodeNm:type,SmryNo:f.SmryNo,SmryNm:summary,CancTpNm:cancel,CrcyCode:'KRW',side:match[1]==='매수'?'BUY':'SELL'}]};
 const result=ledgerToTrade({...row,fields},rules);
 return {...result,mappingVersion:ORDINARY_MAPPING_VERSION};
}
