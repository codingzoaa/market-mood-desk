import importlib.util
from pathlib import Path
import unittest
import pandas as pd
spec=importlib.util.spec_from_file_location('breadth',Path(__file__).parents[1]/'scripts/update_market_breadth.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class CalendarSmaTests(unittest.TestCase):
    def setUp(self):
        self.days=pd.bdate_range('2026-01-05',periods=45)
        self.frame=pd.DataFrame([{'Date':d,'Code':'000001','Market':'KOSPI','Close':100-i,'Volume':10} for i,d in enumerate(self.days)])
    def test_twenty_calendar_observations_required(self):
        r=b.calculate_daily(self.frame,self.days)
        self.assertEqual(int(r.iloc[18].validStockCount),0)
        self.assertEqual(int(r.iloc[19].validStockCount),1)
        self.assertEqual(float(r.iloc[19].below20Pct),100)
    def test_missing_session_breaks_twenty_sessions(self):
        r=b.calculate_daily(self.frame.drop(index=20),self.days)
        self.assertTrue((r.iloc[20:40].validStockCount==0).all())
        self.assertEqual(int(r.iloc[40].validStockCount),1)
    def test_zero_volume_is_not_forward_filled(self):
        self.frame.loc[20,'Volume']=0
        r=b.calculate_daily(self.frame,self.days)
        self.assertTrue((r.iloc[20:40].validStockCount==0).all())
    def test_duplicate_session_rejected(self):
        with self.assertRaises(ValueError): b.calculate_daily(pd.concat([self.frame,self.frame.iloc[:1]]),self.days)
    def test_incomplete_source_cannot_publish(self):
        with self.assertRaises(b.NotReady): b.validate_ls({'progress':{'status':'RUNNING','received':20,'total':900}},'2026-11-06')

class RefreshGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.today=b.datetime.now(b.KST).date().isoformat()
        cls.days=pd.bdate_range(end=cls.today,periods=50)
        cls.today=cls.days[-1].date().isoformat()
        cls.stocks=[]
        for i in range(700):
            cls.stocks.append({'symbol':str(i+1).zfill(6),'market':'KOSPI','collectedFor':cls.today,'bars':[{'date':d.strftime('%Y%m%d'),'close':100+j,'volume':10} for j,d in enumerate(cls.days)]})
        cls.payload={'progress':{'status':'COMPLETE'},'record':{'status':'COMPLETE','date':cls.today,'method':'LS_KRX_DAILY_RAW_CLOSE_V1','unit':'KRW','expected':700,'observedAt':cls.today+'T16:40:00+09:00','indexVerification':{'method':'T8429_VS_T1511_AFTER_CLOSE','date':cls.today,'close':5000},'indices':[{'date':d.strftime('%Y%m%d'),'close':5000} for d in cls.days],'stocks':cls.stocks}}
        cls.public=pd.DataFrame([{'Date':d,'Code':s['symbol'],'Market':'KOSPI','Close':100+j,'Volume':10} for s in cls.stocks for j,d in enumerate(cls.days[:-2])])
        cls.original={'schemaVersion':1,'status':'provisional','startDate':cls.days[19].date().isoformat(),'endDate':cls.days[-3].date().isoformat(),'rows':[{'date':d.date().isoformat(),'kospiClose':5000,'below20Pct':0,'validStockCount':700} for d in cls.days[19:-2]]}
    def test_refresh_appends_only_verified_days_and_preserves_existing_rows(self):
        output,report=b.refresh(self.original,self.public,self.payload,self.today)
        self.assertEqual(output['rows'][:len(self.original['rows'])],self.original['rows'])
        self.assertEqual(output['endDate'],self.today)
        self.assertEqual(len(report['restored']),2)
        self.assertEqual(report['matchedSessions'],report['comparedSessions'])
    def test_unexplained_historical_change_blocks_publication(self):
        bad={**self.original,'rows':[dict(r) for r in self.original['rows']]}
        bad['rows'][2]['validStockCount']=699
        with self.assertRaisesRegex(ValueError,'reproduction mismatch'): b.refresh(bad,self.public,self.payload,self.today)
    def test_wrong_closing_index_blocks_publication(self):
        bad={**self.payload,'record':{**self.payload['record'],'indexVerification':{**self.payload['record']['indexVerification'],'close':4990}}}
        with self.assertRaisesRegex(ValueError,'closing value'): b.validate_ls(bad,self.today)

if __name__=='__main__': unittest.main()
