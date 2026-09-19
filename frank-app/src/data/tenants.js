export const TENANTS = [
  {
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
    systemPrompt: `You are Zeeder, a financial AI assistant for Wonderland Educare, an early childhood development centre in Brackenfell, Cape Town. Owner: Bev Manson. 47 learners, 8 staff, NPO (NPO 142-887), banking with Absa. No accounting software in use. Help with financial analysis, cash flow insights, fee collection, WCED subsidy tracking, and business advice. Be concise and practical.`,
    data: {
      MONTHLY: [
        { m:'Jun 26', fees:0, subsidy:0, rev:0, exp:0, net:0, cash:0, take:'No data yet — upload a bank statement to get started.' },
      ],
      WEEKLY_FORECAST: [],
      EXPENSES: [
        { name:'Staff salaries',    value:0, pct:0, color:'#8B72FF' },
        { name:'Rent & utilities',  value:0, pct:0, color:'#FF3D57' },
        { name:'Food & nutrition',  value:0, pct:0, color:'#FF6B35' },
        { name:'Learning materials',value:0, pct:0, color:'#3B9EFF' },
        { name:'Admin & compliance',value:0, pct:0, color:'#F5C518' },
        { name:'Other',             value:0, pct:0, color:'#7A8599' },
      ],
      DEBTORS: [],
      CREDITORS: [],
      CASHFLOW_FLAGS: [],
      HEALTH_CHECKS: [
        { id:'cf',  label:'Cash Runway',        score:0, status:'warn', priority:'MED', message:'Upload a bank statement to calculate your cash runway.',           action:'Upload your most recent bank statement' },
        { id:'fee', label:'Fee Collection',     score:0, status:'warn', priority:'MED', message:'No fee data yet. Add your debtors to track outstanding fees.',     action:'Add outstanding parent fees to the debtors list' },
        { id:'stf', label:'Staff Cost Ratio',   score:0, status:'warn', priority:'MED', message:'No payroll data yet. Upload a bank statement to calculate.',       action:'Upload a bank statement showing salary payments' },
        { id:'sub', label:'WCED Subsidy',       score:0, status:'warn', priority:'MED', message:'No subsidy data yet. Add your subsidy receipts to track income.',  action:'Upload statements showing WCED subsidy deposits' },
        { id:'run', label:'Runway',             score:0, status:'warn', priority:'MED', message:'Cannot calculate runway without cash balance data.',               action:'Upload a bank statement to calculate runway' },
        { id:'cmp', label:'Compliance',         score:0, status:'warn', priority:'MED', message:'No compliance data yet. Review your DSD, NPO and SACE status.',    action:'Confirm DSD, NPO and SACE registrations are current' },
      ],
      BRIEFING: [
        { severity: 'med', text: 'Welcome to Zeeder, Bev! Your Wonderland Educare workspace is ready.' },
        { severity: 'med', text: 'Upload a bank statement to populate your cash flow dashboard.' },
        { severity: 'med', text: 'Add your debtors (outstanding parent fees) and creditors for a complete financial picture.' },
      ],
    },
  },

  {
    id:         'cape-fresh-grocery',
    name:       'Cape Fresh Grocery',
    owner:      'Demo Admin',
    sector:     'Retail — Grocery',
    reg:        'PTY 2021/445891',
    location:   'Bellville, Cape Town',
    children:   null,
    staff:      12,
    accounting: 'Manual (no software)',
    bank:       'Nedbank',
    plan:       'Growth',
    planPrice:  999,
    currency:   'ZAR',
    systemPrompt: `You are Zeeder, a real-time operational finance AI for South African small businesses. You are currently working with Cape Fresh Grocery — a community grocery store in Bellville, Cape Town (2 locations, 12 staff, no accounting software).

CURRENT FINANCIAL POSITION:
- Cash: R 82,000 (Nedbank)
- Monthly Revenue: R 218,000 (cash sales)
- Monthly Expenses: R 212,000
- Net Margin: R 6,000/month (2.8% — tight for retail)
- Staff Wages: R 85,000/month (40% of revenue — within benchmark)
- Stock & Suppliers: R 98,000/month (46% of revenue)
- Runway: 3.8 months

CRITICAL ISSUES:
1. Municipal utility bill overdue — risk of electricity disconnection
2. Stock purchase timing creates monthly cash pressure around the 10th
3. Gross margin 5-8% — below healthy grocery retail target of 10-12%

SA CONTEXT: Know SARS, SA banks, retail supplier credit terms, FMCG wholesale pricing.
STYLE: Plain English. Numbers first. One specific next action per response. 3–5 sentences max.`,
    data: {
      BUSINESS: {
        id:         'cape-fresh-grocery',
        name:       'Cape Fresh Grocery',
        owner:      'Demo Admin',
        sector:     'Retail — Grocery',
        reg:        'PTY 2021/445891',
        location:   'Bellville, Cape Town',
        children:   null,
        staff:      12,
        accounting: 'Manual (no software)',
        bank:       'Nedbank',
        plan:       'Growth',
        planPrice:  999,
        currency:   'ZAR',
      },
      MONTHLY: [
        { m:'Jul', fees:210000, subsidy:0, rev:210000, exp:198000, net:12000,  cash:95000,  take:'Steady July — R 12,000 profit. The Pick n Pay stock payment on the 10th was the main cash pressure, but revenue covered it.' },
        { m:'Aug', fees:215000, subsidy:0, rev:215000, exp:200000, net:15000,  cash:110000, take:'Improved month — R 15,000 profit. Revenue grew slightly and stock costs were managed well.' },
        { m:'Sep', fees:198000, subsidy:0, rev:198000, exp:195000, net:3000,   cash:89000,  take:'Tight September — only R 3,000 profit. Revenue dipped and stock costs stayed high. Watch the gross margin.' },
        { m:'Oct', fees:225000, subsidy:0, rev:225000, exp:205000, net:20000,  cash:108000, take:'Good October — R 20,000 profit. Warmer weather and early holiday shopping drove stronger beverage and snack sales.' },
        { m:'Nov', fees:240000, subsidy:0, rev:240000, exp:215000, net:25000,  cash:122000, take:'Strong November — R 25,000 profit. Pre-holiday restocking from customers boosted volumes across all categories.' },
        { m:'Dec', fees:320000, subsidy:0, rev:320000, exp:278000, net:42000,  cash:164000, take:'Best month of the year — R 42,000 profit. December holiday spending lifted revenue by R 102,000 vs a normal month. Build a reserve from this surplus.' },
        { m:'Jan', fees:195000, subsidy:0, rev:195000, exp:192000, net:3000,   cash:85000,  take:'January slump — only R 3,000 profit. Post-holiday customer spending dropped significantly. This is predictable; plan for it.' },
        { m:'Feb', fees:205000, subsidy:0, rev:205000, exp:198000, net:7000,   cash:91000,  take:'Recovering — R 7,000 profit. Back-to-school spending and a return to normal trading patterns helped.' },
        { m:'Mar', fees:210000, subsidy:0, rev:210000, exp:202000, net:8000,   cash:98000,  take:'R 8,000 profit. Consistent month with no major cost spikes. Stock pricing from Pick n Pay held steady.' },
        { m:'Apr', fees:208000, subsidy:0, rev:208000, exp:201000, net:7000,   cash:94000,  take:'R 7,000 profit. Stable trading conditions but the margin is still thin. The overdue municipal bill is the main concern.' },
        { m:'May', fees:212000, subsidy:0, rev:212000, exp:205000, net:7000,   cash:88000,  take:'R 7,000 profit. Revenue and costs holding steady. Cash is drifting down — the stock payment cycle is the culprit.' },
        { m:'Jun', fees:218000, subsidy:0, rev:218000, exp:212000, net:6000,   cash:82000,  take:'Thin June — R 6,000 profit, the lowest non-January month. Mid-year customer spend is soft. Pay the overdue utility bill before July.' },
      ],
      WEEKLY_FORECAST: [
        { wk:'Jul W1', inflow:58000, outflow:42000, balance:98000,  salary:false, subsidy:false },
        { wk:'Jul W2', inflow:52000, outflow:78000, balance:72000,  salary:false, subsidy:false },
        { wk:'Jul W3', inflow:60000, outflow:95000, balance:37000,  salary:true,  subsidy:false },
        { wk:'Jul W4', inflow:65000, outflow:15000, balance:87000,  salary:false, subsidy:false },
        { wk:'Aug W1', inflow:59000, outflow:42000, balance:104000, salary:false, subsidy:false },
        { wk:'Aug W2', inflow:53000, outflow:78000, balance:79000,  salary:false, subsidy:false },
        { wk:'Aug W3', inflow:61000, outflow:95000, balance:45000,  salary:true,  subsidy:false },
        { wk:'Aug W4', inflow:66000, outflow:15000, balance:96000,  salary:false, subsidy:false },
        { wk:'Sep W1', inflow:50000, outflow:42000, balance:104000, salary:false, subsidy:false },
        { wk:'Sep W2', inflow:48000, outflow:78000, balance:74000,  salary:false, subsidy:false },
        { wk:'Sep W3', inflow:52000, outflow:95000, balance:31000,  salary:true,  subsidy:false },
        { wk:'Sep W4', inflow:60000, outflow:15000, balance:76000,  salary:false, subsidy:false },
        { wk:'Oct W1', inflow:58000, outflow:42000, balance:92000,  salary:false, subsidy:false },
      ],
      EXPENSES: [
        { name:'Stock & suppliers',  value:98000, pct:46, color:'#FF3D57' },
        { name:'Staff wages',        value:85000, pct:40, color:'#8B72FF' },
        { name:'Rent & utilities',   value:18000, pct:9,  color:'#FF6B35' },
        { name:'Admin & compliance', value:6000,  pct:3,  color:'#F5C518' },
        { name:'Other',              value:5000,  pct:2,  color:'#7A8599' },
      ],
      DEBTORS: [],
      CREDITORS: [
        { name:'Pick n Pay Wholesale', ref:'SUP-001', amount:68000, due:'2026-07-10', daysLeft:10, overdue:false },
        { name:'Coca-Cola Beverages',  ref:'SUP-002', amount:12000, due:'2026-07-15', daysLeft:15, overdue:false },
        { name:'City of Cape Town',    ref:'UTIL-07', amount:8500,  due:'2026-06-30', daysLeft:0,  overdue:true  },
      ],
      CASHFLOW_FLAGS: [
        {
          id:'stock_payment', severity:'HIGH', title:'Stock Payment Due — R 68,000',
          recurring:true, nextDate:'10 Jul 2026', impact:-68000,
          detail:'Monthly wholesale order payment due on the 10th. Pick n Pay requires payment before next delivery cycle.',
          action:'Ensure R 80,000+ in the account by 8 July. Run weekend specials to move current stock faster.',
          color:'#FF3D57',
        },
        {
          id:'util_overdue', severity:'MED', title:'Municipal Bill Overdue — R 8,500',
          recurring:false, nextDate:'Overdue now', impact:-8500,
          detail:'City of Cape Town electricity and water bill is past due. Continued non-payment risks service disconnection.',
          action:'Pay immediately to avoid disconnection. Set up a debit order to prevent this recurring.',
          color:'#F5C518',
        },
        {
          id:'margin_thin', severity:'MED', title:'Profit Margin Below Target',
          recurring:true, nextDate:'Ongoing', impact:0,
          detail:'Net margin is 2.8% — healthy grocery retail targets 10-12%. Stock costs are the main squeeze.',
          action:'Negotiate a 2% early payment discount with Pick n Pay. Review slow-moving lines for markdowns.',
          color:'#F5C518',
        },
      ],
      HEALTH_CHECKS: [
        { id:'cf',  label:'Cash Flow Health',   score:70, status:'warn', priority:'HIGH', message:'Monthly stock payment creates a recurring cash dip around the 10th. Salary week in W3 compounds this.', action:'Build a R 100,000 float before the 10th each month' },
        { id:'fee', label:'Revenue Consistency', score:82, status:'good', priority:'LOW',  message:'Daily cash sales are stable. December spike is well-managed.', action:'Introduce a loyalty card to grow repeat weekly customers' },
        { id:'stf', label:'Staff Cost Ratio',   score:76, status:'good', priority:'LOW',  message:'40% of revenue — within the healthy retail benchmark of 35–45%.', action:'Review casual staff hours during slow mid-week periods' },
        { id:'sub', label:'Supplier Margin',    score:48, status:'bad',  priority:'HIGH', message:'Stock costs at 46% leave only a 5-8% gross margin — well below the 12-15% retail target.', action:'Negotiate early payment discounts and review 3 slow-moving product lines' },
        { id:'run', label:'Runway',             score:62, status:'warn', priority:'MED',  message:'3.8 months cash runway. January–February are historically slow.', action:'Build R 150,000 reserve by November before the post-December slump' },
        { id:'cmp', label:'Compliance',         score:78, status:'good', priority:'LOW',  message:'CIPC, health permits current. Liquor licence due for renewal.', action:'Renew liquor licence before 30 September to avoid trading without a valid licence' },
      ],
      BRIEFING: [
        { severity: 'high', text: 'The City of Cape Town utility bill of R 8,500 is overdue. Pay today to avoid electricity disconnection at the store.' },
        { severity: 'high', text: 'Stock payment of R 68,000 is due to Pick n Pay on 10 July. You need R 80,000+ in the account by 8 July.' },
        { severity: 'warn', text: 'Your profit margin is 2.8% — target is 10-12%. Renegotiating your wholesale price is the single fastest fix.' },
      ],
    },
  },
]

export function getTenantById(id) {
  return TENANTS.find(t => t.id === id) || TENANTS[0]
}
