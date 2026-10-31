# NV Ops: how every figure is calculated

One calculation layer (`netlify/lib/calc.mjs`, copied to `public/calc.js` for the app) produces every
figure in the app, the PDFs, the emails and the exports. The same dates always give the same totals.

| Measure | Definition |
|---|---|
| Revenue | Sum of job line amounts (quantity × price) on invoices that are not cancelled, by job date. Same basis as before. |
| Direct job costs | Costs recorded on each job: Driver fee (required), plus Fuel, Boat transport, Materials, Loading and Other only when the business paid them. |
| Gross contribution | Revenue − direct job costs. |
| Operating expenses | Running expenses (insurance, licences, repairs, tyres, fuel not tied to a job and so on), by date. Excludes start-up capital and partner transfers. |
| Operating profit | Gross contribution − operating expenses. (Shown before as "net profit"; the figure is unchanged.) |
| Profit margin | Operating profit ÷ revenue. |
| Cash collected | Customer payments dated in the period. |
| Outstanding receivables | Unpaid balances on invoices that are not cancelled, today. Overdue = past due date. |
| Job profit (per invoice) | That invoice's revenue − that invoice's own direct job costs. |
| Partner share (per invoice) | Partner's agreed share (50%) × job profit, once the invoice is paid. |
| Start-up capital | Sum of start-up cost records (unchanged; historical differences are shown, not corrected). |
| Partner transactions | Transfers between partners (profit shares, expense settlements). Never counted as business costs. |
| Driver pay owed | Driver fees on jobs where that driver is chosen − payments recorded to that driver. |

Rules:
- Payments always clear the full invoice balance. Older part-paid records keep their history.
- Driver fee is required on every new job, and on any job dated from 16 October 2026 onwards. Older jobs keep their recorded costs.
- Nothing is double-counted: a partner transfer or driver payment is a record of money moving, not an extra cost.
