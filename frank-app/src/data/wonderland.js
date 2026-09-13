// ─── WONDERLAND EDUCARE — DEMO BUSINESS DATA ─────────────────────────────────
// Replace with live data from Stitch Money / Sage API in production

export const BUSINESS = {
  id:         'wonderland-educare',
  name:       'Wonderland Educare',
  owner:      'Bev Manson',
  sector:     'Early Childhood Development',
  reg:        'NPO 142-887',
  location:   'Brackenfell, Cape Town',
  children:   47,
  staff:      8,
  accounting: 'Manual (no software)',
  bank:       'Absa',
  plan:       'Starter',
  planPrice:  499,
  currency:   'ZAR',
}

export const MONTHLY = [
  { m:'Jul', y:2025, fees:128400, subsidy:28500, rev:156900, exp:138200, net:18700,  cash:48200,  take:'School started well — R 18,700 profit in July. Fee income was steady and expenses were controlled. A good benchmark month.' },
  { m:'Aug', y:2025, fees:131200, subsidy:28500, rev:159700, exp:141500, net:18200,  cash:62400,  take:'Another solid month. R 18,200 profit. Revenue growing, costs manageable.' },
  { m:'Sep', y:2025, fees:129800, subsidy:28500, rev:158300, exp:155200, net:3100,   cash:58900,  take:'Profit dropped sharply to R 3,100 — expenses jumped by R 13,700. Worth checking what caused the spike.' },
  { m:'Oct', y:2025, fees:134600, subsidy:31200, rev:165800, exp:148900, net:16900,  cash:71200,  take:'Recovered well — R 16,900 profit. The WCED subsidy increase helped significantly.' },
  { m:'Nov', y:2025, fees:136200, subsidy:31200, rev:167400, exp:162300, net:5100,   cash:68100,  take:'Thin month: R 5,100 profit. Expenses crept up again. Watch the trend.' },
  { m:'Dec', y:2025, fees:72400,  subsidy:15600, rev:88000,  exp:98400,  net:-10400, cash:42300,  take:'December loss of R 10,400 — this happens every year. Fees halve during the holidays but staff still get paid. You need a reserve fund for next December.' },
  { m:'Jan', y:2026, fees:138800, subsidy:31200, rev:170000, exp:151200, net:18800,  cash:55800,  take:'Strong start to the year — R 18,800 profit, the best month in this period. Good fee collection after the January invoicing.' },
  { m:'Feb', y:2026, fees:140200, subsidy:31200, rev:171400, exp:158700, net:12700,  cash:64200,  take:'Decent month — R 12,700 profit. Revenue grew but so did expenses.' },
  { m:'Mar', y:2026, fees:141500, subsidy:33800, rev:175300, exp:161200, net:14100,  cash:72400,  take:'R 14,100 profit. The subsidy increase in March helped offset rising costs.' },
  { m:'Apr', y:2026, fees:139800, subsidy:33800, rev:173600, exp:168900, net:4700,   cash:69800,  take:'Profit slipped to R 4,700 as expenses grew faster than income — a pattern that is now repeating every month.' },
  { m:'May', y:2026, fees:142300, subsidy:33800, rev:176100, exp:172400, net:3700,   cash:65100,  take:'Only R 3,700 profit. The margin squeeze is getting worse — down 80% since January.' },
  { m:'Jun', y:2026, fees:144000, subsidy:33800, rev:177800, exp:174200, net:3600,   cash:61400,  take:'R 3,600 profit — the lowest non-December month. Expenses are now R 174,200 vs revenue of R 177,800. You are almost breaking even. This cannot continue without a fee increase or cost cut.' },
]

export const WEEKLY_FORECAST = [
  { wk:'Jul W1', inflow:42000,  outflow:23400,  balance:80000,  salary:false, subsidy:false },
  { wk:'Jul W2', inflow:35000,  outflow:8450,   balance:106550, salary:false, subsidy:false },
  { wk:'Jul W3', inflow:55800,  outflow:7125,   balance:155225, salary:false, subsidy:true  },
  { wk:'Jul W4', inflow:10500,  outflow:96725,  balance:69000,  salary:true,  subsidy:false },
  { wk:'Aug W1', inflow:43000,  outflow:23400,  balance:88600,  salary:false, subsidy:false },
  { wk:'Aug W2', inflow:36000,  outflow:8450,   balance:116150, salary:false, subsidy:false },
  { wk:'Aug W3', inflow:56800,  outflow:7125,   balance:165825, salary:false, subsidy:true  },
  { wk:'Aug W4', inflow:11000,  outflow:96725,  balance:80100,  salary:true,  subsidy:false },
  { wk:'Sep W1', inflow:41000,  outflow:24900,  balance:96200,  salary:false, subsidy:false },
  { wk:'Sep W2', inflow:34000,  outflow:8450,   balance:121750, salary:false, subsidy:false },
  { wk:'Sep W3', inflow:55800,  outflow:7125,   balance:170425, salary:false, subsidy:true  },
  { wk:'Sep W4', inflow:10000,  outflow:98225,  balance:82200,  salary:true,  subsidy:false },
  { wk:'Oct W1', inflow:44000,  outflow:23400,  balance:102800, salary:false, subsidy:false },
]

export const EXPENSES = [
  { name:'Staff salaries',    value:94500, pct:54, color:'#8B72FF' },
  { name:'Rent & utilities',  value:28400, pct:16, color:'#FF3D57' },
  { name:'Food & nutrition',  value:19600, pct:11, color:'#FF6B35' },
  { name:'Learning materials',value:14200, pct:8,  color:'#3B9EFF' },
  { name:'Admin & compliance',value:8900,  pct:5,  color:'#F5C518' },
  { name:'Other',             value:8600,  pct:6,  color:'#7A8599' },
]

export const DEBTORS = [
  { name:'Smith, J (Kiara)',   ref:'INV-089', amount:9000, due:'2026-03-01', daysOverdue:115, risk:'high', contact:null },
  { name:'Dlamini, S (Amara)', ref:'INV-101', amount:6000, due:'2026-04-01', daysOverdue:84,  risk:'high', contact:null },
  { name:'Van Wyk, P (Liam)',  ref:'INV-118', amount:3200, due:'2026-05-15', daysOverdue:40,  risk:'med',  contact:null },
  { name:'Fortuin, N (Zoe)',   ref:'INV-119', amount:3200, due:'2026-05-15', daysOverdue:40,  risk:'med',  contact:null },
  { name:'Petersen, K (Noah)', ref:'INV-120', amount:3200, due:'2026-05-15', daysOverdue:40,  risk:'med',  contact:null },
  { name:'Williams, T (Ella)', ref:'INV-131', amount:1600, due:'2026-06-01', daysOverdue:23,  risk:'low',  contact:null },
  { name:'Jacobs, R (Lena)',   ref:'INV-132', amount:1600, due:'2026-06-01', daysOverdue:23,  risk:'low',  contact:null },
]

export const CREDITORS = [
  { name:'Rand Water Supplies', ref:'SUP-445', amount:45000, due:'2026-07-01', daysLeft:7,  overdue:false },
  { name:'Eskom Prepaid Levy',  ref:'SUP-446', amount:4200,  due:'2026-07-03', daysLeft:9,  overdue:false },
  { name:'Plumbing World',      ref:'SUP-447', amount:12000, due:'2026-07-08', daysLeft:14, overdue:false },
  { name:'Simplpay (Payroll)',  ref:'PAY-JUL', amount:86000, due:'2026-07-25', daysLeft:31, overdue:false },
]

export const CASHFLOW_FLAGS = [
  {
    id:'salary_dip', severity:'HIGH', title:'Post-Salary Cash Dip',
    recurring:true, nextDate:'25 Jul 2026', impact:-94500,
    detail:'Every month on the 25th, salary drops cash by R 94,500 in a single day. In July this takes cash from ~R 155k to ~R 61k.',
    action:'Ensure R 110k+ in account before the 25th. Chase outstanding fees in weeks 1–3.',
    color:'#FF3D57',
  },
  {
    id:'fee_gap', severity:'HIGH', title:'Outstanding Fees — R 27,800 Uncollected',
    recurring:false, nextDate:'Ongoing', impact:-27800,
    detail:'R 27,800 in uncollected fees across 7 families. Smith family (R 9,000 × 3 months) is at write-off risk.',
    action:'Send final demand to Smith family. Implement 2-month overdue suspension policy. Move to debit orders.',
    color:'#FF3D57',
  },
  {
    id:'dec_shortfall', severity:'HIGH', title:'December Holiday Shortfall',
    recurring:true, nextDate:'1 Dec 2026', impact:-30000,
    detail:'December 2025 was a R 10,400 net loss. Fees halve during holidays but salaries run in full. Cash fell to R 42,300.',
    action:'Build R 80,000 reserve fund. Set aside R 10k/month from July–November.',
    color:'#F5C518',
  },
  {
    id:'subsidy_timing', severity:'MED', title:'WCED Subsidy Mid-Month Timing Gap',
    recurring:true, nextDate:'~15 Jul 2026', impact:0,
    detail:'WCED subsidy arrives around the 15th. Weeks 1–2 run on fee income only. Slow fee collection creates week-1 cash dip.',
    action:'Prioritise fee collection in week 1. Consider R 20k overdraft facility for timing gaps.',
    color:'#F5C518',
  },
  {
    id:'margin_compress', severity:'MED', title:'Margin Compressing — 6 Months Straight',
    recurring:false, nextDate:'Ongoing', impact:0,
    detail:'Net margin dropped from R 18,800 (Jan) to R 3,600 (Jun) — 81% decline. At this rate, loss-making by September.',
    action:'Reduce staff overtime (R 6,200/month). Review food supplier. Implement R 150/month fee increase from Q4.',
    color:'#F5C518',
  },
]

export const HEALTH_CHECKS = [
  { id:'cf',  label:'Cash Flow Health',   score:52, status:'warn', priority:'HIGH', message:'Margin compressed 81% since Jan. Post-salary dip and fee gaps create recurring risk.',      action:'Fix fee collection + salary timing buffer' },
  { id:'fee', label:'Fee Collection',     score:68, status:'warn', priority:'HIGH', message:'R 27,800 outstanding. 84.3% collection rate vs 95% target.',                               action:'Debit orders + 2-month suspension policy',    benchmark:{ actual:'84.3%', target:'95%', warn:true } },
  { id:'stf', label:'Staff Cost Ratio',   score:46, status:'bad',  priority:'HIGH', message:'54% of revenue — 9 points above the 45% benchmark for sustainable educare.',               action:'Review overtime. Restructure 2 part-time roles.', benchmark:{ actual:'54%', target:'45%', warn:true } },
  { id:'sub', label:'WCED Subsidy',       score:85, status:'good', priority:'LOW',  message:'Subsidy current. Registers compliant.',                                                     action:'Submit Q3 registers by 31 July' },
  { id:'run', label:'Runway',             score:60, status:'warn', priority:'MED',  message:'4.1 months. December repeat is 5 months away.',                                            action:'Build R 80k holiday reserve by November',     benchmark:{ actual:'4.1 months', target:'3+ months', warn:false } },
  { id:'cmp', label:'Compliance',         score:88, status:'good', priority:'LOW',  message:'DSD, NPO, SACE all current.',                                                              action:'Renew municipal zoning by 15 Aug' },
]

export const FRANK_SYSTEM_PROMPT = `You are Zeeder, a real-time operational finance AI for South African small businesses. You are currently working with Wonderland Educare — an early childhood development centre in Brackenfell, Cape Town (47 learners, 8 staff, no accounting software).

DATA SOURCES: Standard Bank statement (uploaded monthly) + Debtor list (Excel) + Creditor list (Excel).

CURRENT FINANCIAL POSITION:
- Cash: R 61,400 (Absa)
- Monthly Revenue: R 177,800 (R 144,000 fees + R 33,800 WCED subsidy)
- Monthly Expenses: R 174,200 (GROWING FASTER THAN REVENUE)
- Net Margin: R 3,600/month (down 81% from R 18,800 in January — CRITICAL)
- Staff Costs: R 94,500/month (54% of revenue — benchmark is 45%)
- Runway: 4.1 months
- Outstanding Fees (AR): R 27,800 — Smith family R 9,000 × 3 months (write-off risk)
- Creditors due this week: R 45,000 (Rand Water Supplies)
- Next salary run: 25 July — drops cash by R 94,500

CRITICAL ISSUES:
1. Staff cost ratio 54% — unsustainable, must reduce to 45%
2. Fee collection at 84.3% — missing R 22,500/month vs target
3. December structural shortfall — recurring every year
4. Margin declining 6 consecutive months

SA CONTEXT: Know SARS, WCED subsidies, DSD registration, NPO compliance, SA banks, Stitch Money open banking.
STYLE: Plain English. Numbers first. One specific next action per response. 3–5 sentences max.`
