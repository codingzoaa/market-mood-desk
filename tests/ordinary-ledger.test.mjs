import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ordinaryLedgerToTrade} from '../worker/account/ordinary-trades.mjs';import {analyzeAccount} from '../src/account/analysis.ts';
import {accountWorker} from '../worker/account/app.mjs';import {normalizeLedgerRow} from '../worker/account/cdpcq04700.mjs';import {saveLedger} from '../worker/account/ledger-store.mjs';import {b64} from '../worker/account/security.mjs';import {SQLiteD1} from './helpers/sqlite-d1.mjs';
// Synthetic arithmetic fixtures only. No production account records or amounts are embedded.
const row=(extra={})=>({source:'LS:CDPCQ04700',accountRef:'synthetic-owner',date:'2026-10-20',id:'1',fields:{TpCodeNm:'매수',SmryNo:'0001',SmryNm:'보통매수_KRX',CancTpNm:'',CrcyCode:'KRW',OrgTrdNo:'0',LoanDt:'',IsuNo:'A005930',IsuNm:'합성 종목',TrdQty:'10',TrdUprc:'100',TrdAmt:'1000',CmsnAmt:'10',TaxSumAmt:'0',Trtax:'0',EvrTax:'0',Ictax:'0',Ihtax:'0',TrxTime:'100000000',TrdNo:'1',...extra}});
test('confirmed ordinary KRX and NXT trades join into one moving-average position without duplicate tax',()=>{
 const a=ordinaryLedgerToTrade(row()).trade;
 const b=ordinaryLedgerToTrade({...row({SmryNm:'보통매수_NXT',TrdNo:'2',TrdUprc:'200',TrdAmt:'2000'}),id:'2'}).trade;
 const c=ordinaryLedgerToTrade({...row({TpCodeNm:'매도',SmryNm:'보통매도_NXT',TrdNo:'3',TrdQty:'5',TrdUprc:'300',TrdAmt:'1500',CmsnAmt:'5',TaxSumAmt:'15',Trtax:'12',EvrTax:'3'}),id:'3'}).trade;
 const s=analyzeAccount([c,b,a]);assert.equal(s.realizedKRW,725);assert.equal(s.feesKRW,40);assert.equal(s.knownSells,1);assert.equal(s.holdings.length,1);assert.equal(s.holdings[0].quantity,15);assert.equal(s.holdings[0].cost,2265);
 assert.equal(ordinaryLedgerToTrade(row({CrcyCode:'',TrxTime:'101112',IsuNo:'005930'})).trade.time,'10:11:12');
});
test('unknown types, cancellation, credit, foreign currency, missing total tax and bad identities stay blocked',()=>{
 for(const extra of [{TpCodeNm:'매도'},{SmryNm:'신용매수_KRX'},{CancTpNm:'취소'},{OrgTrdNo:'1'},{LoanDt:'20261001'},{CrcyCode:'USD'},{FcurrTrdAmt:'1'},{TaxSumAmt:null},{TaxSumAmt:'0',Trtax:'10'},{IsuNo:'unknown'},{TrxTime:'invalid'}])assert.ok(ordinaryLedgerToTrade(row(extra)).issue);
});
test('saved encrypted ordinary ledger now fills authenticated analysis; account identifiers never leave the Worker',async()=>{
 const db=new SQLiteD1();db.sqlite.exec(readFileSync(new URL('../worker/account/schema.sql',import.meta.url),'utf8'));
 const env={PRIVATE_DB:db,LS_ACCOUNT_NO:'synthetic-owner',ACCOUNT_ENCRYPTION_KEY:b64(crypto.getRandomValues(new Uint8Array(32))),ACCOUNT_INDEX_KEY:b64(crypto.getRandomValues(new Uint8Array(32)))};
 const worker=accountWorker({verify:async()=>({authenticated:true})});
 try{const records=[row(),{...row({TpCodeNm:'매도',SmryNm:'보통매도_NXT',TrdNo:'2',TrdQty:'5',TrdUprc:'150',TrdAmt:'750',CmsnAmt:'2',TaxSumAmt:'3',Trtax:'3'}),id:'2'}];
 await saveLedger(env,records);const r=await worker.fetch(new Request('https://private.test/api/account'),env,{});assert.equal(r.status,200);const d=await r.json();assert.equal(d.ledgerStatus.analysisBlocked,false);assert.equal(d.ledgerStatus.mappedTrades,2);assert.equal(d.ledgerStatus.buyTrades,1);assert.equal(d.ledgerStatus.sellTrades,1);assert.equal(d.summary.realizedKRW,240);assert.equal(d.summary.feesKRW,15);assert.equal(d.recentTrades.length,2);assert.doesNotMatch(JSON.stringify(d),/synthetic-owner|accountRef/);
 }finally{db.close();}
});
