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
if __name__=='__main__': unittest.main()
