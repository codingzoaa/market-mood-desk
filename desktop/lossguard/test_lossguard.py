import unittest
from datetime import datetime, timezone
from engine import DEFAULT, step, settings
from ls_client import order_count, integer
class GuardTests(unittest.TestCase):
    def calc(self, previous=None, pnl=0, at='2026-11-25T01:00:00+00:00', config=None, **kwargs):
        sample = dict(date=at[:10], at=at, equityKRW=10000000, realizedKRW=pnl, unrealizedKRW=50000, **kwargs)
        return step(previous, sample, config, datetime.fromisoformat(at))
    def test_threshold_and_fixed_equity(self):
        s = self.calc(pnl=-240000)
        self.assertEqual(s['limitKRW'], 300000)
        self.assertEqual(s['alerts'][0]['kind'], 'WARNING')
        s = self.calc(s, -300000, '2026-11-25T01:01:00+00:00')
        self.assertEqual(s['alerts'][0]['kind'], 'LIMIT')
        s = self.calc(s, -300000, '2026-11-25T01:02:00+00:00')
        self.assertEqual(s['alerts'], [])
        s = self.calc(s, -300000, '2026-11-25T01:06:00+00:00')
        self.assertEqual(s['alerts'][0]['kind'], 'LIMIT')
    def test_combined_and_rollover(self):
        s = self.calc(config={'mode': 'combined'})
        self.assertEqual(s['pnlKRW'], 0)
        sample = dict(date='2026-11-25', at='2026-11-25T01:01:00+00:00', equityKRW=10000000, realizedKRW=50000, unrealizedKRW=0)
        s = step(s, sample, {'mode': 'combined'}, datetime.fromisoformat(sample['at']))
        self.assertEqual(s['pnlKRW'], 0)
        s = self.calc(s, 0, '2026-11-26T01:00:00+00:00')
        self.assertEqual(s['date'], '2026-11-26')
    def test_partial_fills_and_original_time(self):
        def row(i, parent, time, qty):
            return dict(OrdDt='20261125', BnsTpCode='2', OrdNo=i, OrgOrdNo=parent, OrdTime=time, AllExecQty=qty)
        self.assertEqual(order_count([row('1','0','105900',0), row('2','1','110200',5), row('3','0','110100',2), row('3','0','110100',5)], '2026-11-25', '11:00'), 1)
        with self.assertRaises(ValueError):
            order_count([row('2','1','110200',5)], '2026-11-25','11:00')
    def test_strict_inputs(self):
        for v in (None, True, '1.0', '1e2', ''):
            with self.assertRaises(ValueError):
                integer(v)
        for c in ({'afternoonAt':'11:69'}, {'limitPercent':0}, {'tradeWarn':1.5}):
            with self.assertRaises(ValueError):
                settings(c)
    def test_giveback_and_delayed_baseline(self):
        s = self.calc(pnl=100000, at='2026-11-25T03:00:00+00:00')
        self.assertTrue(s['morningEstimated'])
        s = self.calc(s, 50000, '2026-11-25T03:01:00+00:00', afternoonOrders=20)
        self.assertEqual(s['givebackPercent'], 50)
        self.assertEqual({a['kind'] for a in s['alerts']}, {'GIVEBACK','OVERTRADE'})
if __name__ == '__main__':
    unittest.main()
