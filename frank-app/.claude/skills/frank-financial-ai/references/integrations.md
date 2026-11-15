# Frank — Integrations Reference

Read this file when you need to know how to query a specific connected system,
what data it provides, and what to do if it fails.

---

## Accounting Systems

### QuickBooks Online
- **What it provides**: Invoices (AR), bills (AP), P&L, expenses, chart of accounts
- **Key queries**: `GET /reports/ProfitAndLoss`, `GET /invoice`, `GET /bill`
- **Fallback**: If unavailable, check Google Drive for exported reports

### Xero
- **What it provides**: Same as QuickBooks
- **Key queries**: `/api.xro/2.0/Reports/ProfitAndLoss`, `/api.xro/2.0/Invoices`
- **Fallback**: Same as QuickBooks

### Sage
- **What it provides**: Same scope; older API, slower responses
- **Note**: Sage syncs may lag 2–4h. Always show sync timestamp.

---

## Payroll Systems

### Gusto (US)
- **What it provides**: Employee headcount, salary/wage data, payroll run history
- **Use for**: Payroll line in burn rate

### Simplpay (SA)
- **What it provides**: Same as Gusto for South African payroll
- **Note**: Data refreshes after each pay run (monthly/bi-weekly)

---

## Bank Feed Providers

### Plaid (US, CA)
- **Covers**: Most US and Canadian banks
- **Provides**: Account balances, transaction history, account metadata
- **Refresh**: Can trigger on-demand balance refresh

### Flinks (CA)
- **Covers**: Canadian banks not on Plaid
- **Provides**: Same as Plaid

### Akahu (NZ)
- **Covers**: New Zealand banks
- **Provides**: Balances and transactions

### ACSISS + SA Banks (ZA, AU, UK)
- **Covers**: South African major banks (Standard Bank, Absa, FNB, Nedbank, Capitec)
  plus Australian and UK banks
- **Frank's primary region**: South Africa (Gaz2Go, SLI)
- **Note**: Some SA banks use screen-scraping fallback; flag if credentials need refresh

---

## Fallback Logic

If a system is unreachable:
1. Show last cached data with ⚠️ STALE warning + timestamp
2. Tell user which system is down
3. Suggest manual workaround if available (e.g. "Check QuickBooks directly")
4. Do NOT fabricate numbers or extrapolate without saying so

If NO systems are connected:
- Explain the connection steps
- Offer to walk user through connecting their first data source
- Do NOT pretend to have financial data

---

## Gaz2Go / SLI Context (Frank Manson's businesses)

When operating for Frank specifically:

| Entity | Primary bank | Accounting | Payroll |
|---|---|---|---|
| Gaz2Go (LPG vending) | Standard Bank + Absa | QuickBooks or Xero | Simplpay |
| SLI Investments | Standard Bank | Xero | N/A (holding co) |

Revenue model for Gaz2Go: LPG vending machine sales + gas cylinder refills.
Key cost drivers: Afrox/Linde gas supply, Teltonika/Milesight IoT hardware, payroll.

When answering financial questions for Frank, apply this business context automatically —
e.g. if Afrox payment is overdue in AP, flag it as supply-chain critical, not just a bill.

---

## Operational Systems (Job / Project Management)

These feed job-level cost data into Frank's operational cost analysis.
Frank uses this to answer: "Is this job/project profitable?" and
"Are operational costs eating into my margins?"

### Supported integrations
| Tool | What Frank pulls | Use case |
|---|---|---|
| **Asana** | Task hours, project status, team assignments | Time cost per job |
| **Monday.com** | Job boards, budgets, delivery status | Budget vs actual per project |
| **Jobber** (trades) | Job cards, time on-site, materials used | SA trades businesses |
| **ServiceM8** (trades) | Job costing, time, materials, invoicing | Plumbing, electrical, HVAC |
| **Basecamp** | Project activity, time tracking | Agency / consulting |
| **Custom/manual** | CSV import or webhook from any tool | Fallback for any system |

### What Frank calculates from operational data

**Cost Per Job**
```
Cost Per Job = (Staff hours × hourly rate) + Materials + Overheads allocated
Margin Per Job = Invoice value - Cost Per Job
Job Margin % = Margin Per Job / Invoice value × 100
```

**Operational Cost Trend**
```
Is the cost to deliver a job increasing faster than the revenue per job?
Flag when: Cost Per Job growth rate > Revenue Per Job growth rate (rolling 90 days)
```

**Capacity Utilisation**
```
Utilisation % = Billable hours / Total available hours × 100
Flag when: Utilisation < 60% (idle capacity costing money)
Flag when: Utilisation > 90% (risk of overrun and quality issues)
```

### Frank questions unlocked by operational integration
- "Which jobs are most profitable?"
- "Am I making money on [client/project type]?"
- "Is my team's time cost tracking to budget?"
- "Where am I leaking margin?"
- "What's my average job margin this month vs last?"

---

## HR & People Systems

These feed headcount and payroll costs into Frank's burn rate and cost structure analysis.
Frank uses this to answer: "Is my people cost growing in line with revenue?" and
"What is my fully-loaded cost per head?"

### Supported integrations
| Tool | What Frank pulls | Region |
|---|---|---|
| **Simplpay** | Payroll runs, employee costs, deductions | SA (primary) |
| **PaySpace** | Payroll, leave, PAYE submissions | SA |
| **Gusto** | Payroll + benefits | US |
| **BambooHR** | Headcount, roles, salary bands | Global |
| **Leave management (any)** | Leave days taken vs entitlement | SA compliance |

### What Frank calculates from people data

**Fully-Loaded Cost Per Head**
```
Fully-Loaded Cost = Gross salary + Employer UIF + SDL + Benefits + Equipment allocation
```

**Payroll as % of Revenue**
```
Payroll Ratio = Total monthly payroll / Monthly revenue × 100
Healthy range for SA service businesses: 25–45%
Flag when: > 55% (payroll consuming too much revenue)
Flag when: < 15% (may indicate contractor overuse or data gap)
```

**Headcount vs Revenue Efficiency**
```
Revenue Per Head = Monthly revenue / Number of employees
Track trend: is each employee generating more or less revenue over time?
```

**PAYE & Compliance**
```
Flag approaching PAYE submission deadline (7th of each month)
Flag when payroll run is late (risk of SDL/UIF penalties)
```

### Frank questions unlocked by people integration
- "What is my fully-loaded cost per employee?"
- "Is my payroll growing faster than my revenue?"
- "What does it actually cost me to hire one more person?"
- "Am I compliant with PAYE this month?"
- "Which department has the highest people cost?"

---

## Integration Data Flow into Frank's Core Metrics

This is how operational and people data feeds the 5 core metrics:

```
Simplpay / PaySpace
        │
        ▼ Payroll costs
    BURN RATE ◄──── Operational systems (job overruns, materials)
        │
        ▼
    RUNWAY (more accurate because burn includes true people + ops cost)

Operational systems (Jobber, ServiceM8, Asana)
        │
        ▼ Job revenue + job costs
    SALES PERFORMANCE ◄─── Revenue per job, margin per job
        │
        ▼
    AR / AP (invoices tied to specific jobs)

All integrations together
        │
        ▼
    WHAT-IF SCENARIOS (e.g. "what if I hired one more technician?")
    → Frank models fully-loaded cost, not just salary
```

---

## Reporting Frank Unlocks With Full Integration

When bank feeds + accounting + payroll + operations are all connected,
Frank can produce these reports on demand:

| Report | What it answers |
|---|---|
| **Operational Cost Report** | Are job/project costs in line with budget? |
| **People Cost Report** | Is headcount spend justified by revenue? |
| **Margin by Job Type** | Which services make the most money? |
| **Cost Structure Analysis** | How is every R 1 of revenue being spent? |
| **Efficiency Trend** | Are we getting better or worse at delivering profitably? |

These are the reports that previously required a CFO or management accountant.
Frank produces them in real time, from connected data, on demand.

---

## Manual Upload — Data Tier System

Frank works at 4 levels of data sophistication. A business never needs
accounting software to get value. The tier determines what Frank can answer.

### Tier 1 — Bank Statement Upload Only
**What to upload**: Monthly bank statement (CSV or PDF)
**Frank can answer**: Cash position, inflows vs outflows, spending by category,
burn rate, monthly trend, flagged large transactions
**Frank cannot answer**: Who owes you, what you owe suppliers, P&L by job
**Who uses this**: Businesses with no systems — just a bank account

### Tier 2 — Bank + Debtor & Creditor Lists
**What to upload**: Bank statement + debtor list + creditor list
(CSV, Excel, or PDF invoices/statements)
**Frank can answer**: Everything in Tier 1 + AR aging + AP aging +
cashflow forecast + collection rate + payment prioritisation
**Who uses this**: Businesses with a clerk managing debtors/creditors manually

### Tier 3 — Live Bank Feed (Stitch Money)
**What to upload**: Nothing — direct bank connection, auto-syncs daily
**Frank can answer**: Everything in Tier 2 + real-time balance + instant alerts
**Who uses this**: Businesses ready for automation, no accounting software needed

### Tier 4 — Bank Feed + Accounting Software
**What to upload**: Nothing — all systems connected
**Frank can answer**: Full P&L + job margins + payroll analysis + benchmarking
**Who uses this**: Businesses on Sage, Xero, or QuickBooks

---

## PDF Parsing — Document Intelligence

Frank uses Claude's document intelligence to read PDFs. No fixed template required.
Frank reads the document, understands its structure, and extracts the relevant data.

### Supported PDF Types

| PDF Type | What Frank Extracts | Accuracy |
|---|---|---|
| **Supplier invoice** | Supplier name, invoice no, amount, VAT, due date | Very high |
| **Customer invoice** | Client name, invoice no, amount, due date | Very high |
| **Aged creditor analysis** | All suppliers, amounts, aging buckets | High |
| **Aged debtor analysis** | All clients, amounts, aging buckets | High |
| **Bank statement (PDF)** | All transactions, dates, amounts, running balance | High |
| **Remittance advice** | Supplier, amount paid, invoice references | High |
| **Statement of account** | Outstanding invoices, payments, balance | High |
| **Scanned/image PDFs** | Requires OCR — lower accuracy, always review | Medium |

### PDF Parsing Workflow

```
1. User uploads PDF(s) — single invoice or bulk (up to 20 at once)
        ↓
2. Frank reads each PDF via Claude document API
   Prompt: "Extract all invoice/debtor/creditor data from this document.
   Return: entity_name, reference, amount_excl_vat, vat_amount,
   amount_incl_vat, invoice_date, due_date, document_type"
        ↓
3. Frank returns structured data for user review
        ↓
4. User confirms, edits, or rejects each extracted record
        ↓
5. Confirmed records added to debtor or creditor list
        ↓
6. Frank immediately recalculates AR/AP totals and cashflow flags
```

### Bulk PDF Upload Rules
- Max 20 PDFs per upload session
- Max 10MB per file
- Multiple invoice PDFs processed in parallel (up to 5 at once)
- Always show extracted data for human review before committing
- Never auto-commit PDF data without confirmation — OCR/parse errors happen

### What Frank Tells the User After PDF Parsing

```
"I read 8 supplier invoices. Here's what I found:

Total extracted: R 234,500 across 8 creditors
Highest: Rand Water Supplies — R 45,000 due 1 July
Earliest due: ABC Supplies — R 12,000 due TODAY

Please review and confirm. I've flagged 1 record where I wasn't
100% sure of the amount — marked with ⚠ for your check."
```

### Edge Cases

- **Scanned PDFs (image-only)**: Frank warns accuracy may be lower.
  Always flag for human review. Suggest user re-scan at higher resolution.
- **Multi-invoice PDFs** (e.g. a statement with 10 invoices): Frank
  extracts each invoice as a separate record.
- **Foreign currency**: Frank extracts original currency and converts
  to ZAR at today's rate. Always shows both amounts.
- **Missing due date**: Frank defaults to 30 days from invoice date
  and flags it: "No due date found — defaulted to 30 days. Please confirm."
- **VAT ambiguity**: If unclear whether amount includes VAT, Frank
  asks: "Is R 45,000 VAT-inclusive or exclusive?"
- **Duplicate detection**: If same invoice reference already exists
  in the list, Frank warns: "This invoice ref already exists. Skip or replace?"


---

## Data Upload Tiers — For Businesses Without Live Connections

Frank works at 4 levels. Every level is valid. Never require a higher tier as a prerequisite.

```
TIER 1 — Bank Statement Upload only
  Input:  CSV or PDF bank statement (monthly)
  Gives:  Cash balance, inflows/outflows, spending categories, burn rate
  Missing: Debtor aging, creditor aging, P&L

TIER 2 — Bank Statement + Debtor/Creditor Lists
  Input:  Tier 1 + debtor list + creditor list (CSV, Excel, or PDF)
  Gives:  Everything in Tier 1 + AR aging + AP aging + cashflow forecast
  Missing: Detailed P&L, job margins, payroll breakdown

TIER 3 — Live Bank Feed (Stitch Money)
  Input:  Stitch open banking connection (SA banks)
  Gives:  Everything in Tier 2 + real-time balance + automatic daily sync
  Missing: Accounting software reports

TIER 4 — Full Stack (Bank + Accounting Software)
  Input:  Stitch + Sage / Xero / QuickBooks
  Gives:  All 5 core metrics + P&L + job costing + payroll integration
```

---

## Document Upload — Accepted Formats

Frank accepts documents from a debtor/creditor clerk who does not use accounting software.
Use the Claude API (claude-sonnet-4-20250514) with `type: "document"` to extract structured data.

### Bank Statements
| Format | Notes |
|---|---|
| CSV (any SA bank) | Preferred — clean structured data |
| PDF (digital/text) | Claude reads natively — high accuracy |
| PDF (scanned/image) | Claude reads with moderate accuracy — flag low-confidence extractions |
| Excel (.xlsx) | Parse with SheetJS, then process as CSV |

**SA bank CSV formats vary — Claude auto-detects structure. Do not use rigid column parsers.**

### Debtor Documents (AR)
| Document Type | What Frank extracts |
|---|---|
| Age analysis PDF (from Sage/Xero/QB export) | All debtors, amounts, aging buckets (30/60/90 days) |
| Individual customer invoice PDF | Client name, invoice number, amount, due date |
| Customer statement PDF | Outstanding balance, payment history |
| Debtor list Excel/CSV | Client name, ref, amount, date — any column layout |
| Scanned/photographed invoice | Same as PDF with moderate confidence |
| WhatsApp screenshot of invoice | Claude reads — flag for manual verification |

### Creditor Documents (AP)
| Document Type | What Frank extracts |
|---|---|
| Supplier invoice PDF | Supplier name, invoice ref, line items, total, due date |
| Supplier statement PDF | Outstanding balance, individual invoices listed |
| Age analysis PDF | All creditors, amounts, aging |
| Creditor list Excel/CSV | Supplier, ref, amount, due date |
| Remittance advice PDF | Payment details for reconciliation |
| Utility bill PDF | Supplier, period, amount, due date |

---

## PDF Extraction — API Call Pattern

```javascript
// Convert file to base64
const toBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(file);
});

// Extract structured data from any document
const extractFromDocument = async (file, documentType) => {
  const base64 = await toBase64(file);
  const mediaType = file.type === "application/pdf" ? "application/pdf"
    : file.type.startsWith("image/") ? file.type
    : "application/pdf";

  const prompt = documentType === "debtor"
    ? `Extract all debtor/accounts receivable information from this document.
       Return ONLY valid JSON: { "debtors": [{ "name", "reference", "amount", "invoice_date", "due_date", "days_overdue", "contact" }] }
       If a field is not found, use null. Amount must be a number (no currency symbols).`
    : documentType === "creditor"
    ? `Extract all creditor/accounts payable information from this document.
       Return ONLY valid JSON: { "creditors": [{ "supplier", "reference", "amount", "invoice_date", "due_date", "days_until_due", "contact" }] }
       If a field is not found, use null. Amount must be a number.`
    : `Extract all financial transactions from this bank statement.
       Return ONLY valid JSON: { "transactions": [{ "date", "description", "debit", "credit", "balance", "category" }] }
       Dates as YYYY-MM-DD. Amounts as numbers (no R symbols). Category: guess from description.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: mediaType, data: base64 }
          },
          { type: "text", text: prompt }
        ]
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";
  // Strip markdown fences if present
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};
```

---

## Extraction Confidence Levels

After extracting, Frank should flag confidence to the user:

| Situation | Confidence | Frank behaviour |
|---|---|---|
| Digital PDF (text-based) | High | Show extracted data, allow edits |
| Scanned PDF (clear scan) | Medium | Show data, highlight fields needing verification |
| Scanned PDF (poor quality) | Low | Show data, flag every field, ask user to verify |
| Image/photo of document | Medium | Show data, flag totals for verification |
| Multi-page complex PDF | High | Extract all pages, show page count |
| Handwritten document | Low | Best effort, flag all fields |

Frank never silently fails. If extraction fails or confidence is low: show what was extracted, highlight uncertain fields in amber, and ask the user to verify.

---

## What Frank Cannot Extract

Always tell the user clearly when Frank cannot reliably extract data:
- Severely damaged or blurry scans
- Handwritten ledgers with no structure
- Documents in languages other than English or Afrikaans
- Password-protected PDFs (ask user to remove protection first)
- Spreadsheets with complex macros (convert to CSV first)
