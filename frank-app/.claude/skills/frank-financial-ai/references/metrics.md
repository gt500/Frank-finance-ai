# Frank — Metrics Reference

Read this file when calculating any of the 5 core metrics. It has the exact formulas,
edge cases, and multi-currency handling.

---

## 1. Available Cash

```
Available Cash = Σ(all connected bank account balances, in base currency)
```

**Multi-currency**: Convert to user's base currency using today's mid-market rate.
Show original + converted amount.

**Edge cases**:
- Pending transactions: include as "pending" note, exclude from total
- Overdraft accounts: show as negative, include in sum
- Investment accounts: exclude unless user explicitly asks
- Unconnected accounts: list as ⚠️ NOT CONNECTED, do not estimate

**Stale data warning**: If last bank sync > 4 hours ago, show:
`⚠️ Data last synced [time]. Connect Frank to refresh.`

---

## 2. Sales Performance

```
Revenue (period) = Σ(all paid invoices + POS sales in period, from accounting system)
Period-over-Period Growth = (Current - Previous) / Previous × 100
```

**What counts as revenue**: Paid invoices, completed sales, recognised income.
**What does NOT count**: Unpaid invoices, deposits on incomplete work, inter-company transfers.

**Periods to always show**: Today, This Week (Mon–Sun), This Month, Last Month.
**Trend**: Always show ↑ / ↓ / → with % change vs same period prior.

**Breakdown**: If accounting system has categories/classes, always break down by product
or service line. Top 3 by revenue.

---

## 3. AR — Accounts Receivable

```
Total AR = Σ(all open invoice amounts)
Overdue AR = Σ(invoices where due_date < today)
DSO (Days Sales Outstanding) = (Total AR / Last 90-day Revenue) × 90
```

**Ageing buckets**:
- 🔴 Overdue: due_date < today
- 🟡 Due Soon: due_date within 7 days
- 🟢 Current: due_date > 7 days

**Per invoice, always show**: Client name, invoice number, amount, due date, days overdue.
Sort by days overdue descending.

**Flag**: Any single invoice > 30% of total AR — highlight as concentration risk.

---

## 3b. AP — Accounts Payable

```
Total AP = Σ(all outstanding bills/purchase orders)
```

**Ageing buckets** (same logic as AR, but for when YOU need to pay):
- 🔴 Overdue or Due Today
- 🟡 Due within 7 days
- 🟢 Due later

**Per bill, always show**: Supplier, bill number, amount, due date.

---

## 4. Burn Rate

```
Gross Burn = Σ(all cash outflows in period)
Net Burn = Gross Burn - Revenue
Monthly Burn Rate = Gross Burn / number_of_months_in_period

Use 90-day window as default. Use 30-day if user asks "this month".
```

**Exclude from burn calculation by default**:
- Capital expenditure (one-off asset purchases)
- Loan repayments of principal (interest counts)
- Inter-company transfers

**Include in burn by default**:
- Payroll (all employees + contractors)
- COGS / cost of goods/services
- Rent, utilities, subscriptions
- Loan interest
- Tax payments

**Categories**: Map to these 4 top-level buckets: Payroll | COGS | Overheads | Other.
Sub-categories optional on request.

---

## 5. Runway

```
Runway (months) = Available Cash / Monthly Burn Rate
Runway (date) = today + Runway (months) × 30
```

**Scenario modelling**:
```
Runway with current revenue:
  Monthly Net Burn = Monthly Burn - Monthly Revenue
  If Net Burn < 0: business is profitable, state "cash-positive"
  If Net Burn > 0: Runway = Cash / Net Burn
```

**Conservative scenario**: Use 90-day avg burn + assume 20% revenue drop.
Show alongside base case when runway < 6 months.

---

## What-If Formula

```
New Metric = Base Metric + Delta

Delta for hire:         +monthly_salary to burn rate
Delta for price change: +/- % applied to last 90-day revenue run rate
Delta for new client:   +projected_monthly_revenue to revenue
Delta for cost cut:     -monthly_saving to burn rate
```

Always show: Current → New → Delta.
Always show: Runway impact (current months → new months).

---

## Multi-Currency Rules

- **Base currency**: Detect from accounting system settings. Ask user if ambiguous.
- **Conversions**: Use mid-market rate from open exchange rates API (or accounting system rate).
- **Always show**: Original currency + converted amount in base currency.
- **Volatility note**: For ZAR/USD or any volatile pair, note rate used and date.

---

## Data Freshness Standards

| Source | Max acceptable age | Action if stale |
|---|---|---|
| Bank feeds (Plaid/Flinks/Akahu) | 4 hours | Warn, trigger resync |
| Accounting system | 24 hours | Warn, show last sync time |
| Payroll | Pay period | Note last payroll date |
