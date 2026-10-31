# How NV Ops differs from TIL Ops

Built from TIL Ops (update 14) by the NV converter, so later TIL Ops improvements can be carried across.

- Branding: NV Construction Ltd name, contact details, logo, icons, navy #012c51 and orange #f68d01.
- Job costs: Labour, Materials, Subcontractors, Equipment hire, Fuel & transport, Tipping fees, Other. None is compulsory; jobs with no labour cost are flagged for review.
- Part-payments: deposits and instalments allowed; a payment can never exceed the balance.
- No partners: no profit split, partner transfers, capital contributions or GBP rate. Roles are Owner, Manager, Crew and View only.
- Type of work: NV's services, each belonging to a line of business (Construction, Skip bins, Equipment and haulage). Home and Financial Overview show revenue, costs and contribution by line.
- Areas: NV's ten service areas replace the island routes. Pricing by area is optional, mainly for skip hire.
- Skip Bins: bin register, bins out with days on hire, collect-by dates, collections due, one-tap invoice from a hire (linked to the hire). Crew can record deliveries and collections.
- Engine Hours: hour-meter readings, services recorded at a reading, service interval in hours, Needs Attention when within 25 hours.
- Equipment & Investment replaces Capital & Investment: what the trucks, machines and bins cost against cumulative profit.
- Removed: workbook import from the Trans Island spreadsheet, boat costs, inter-island routes.

## Building projects (residential and commercial)

- Projects: client, site, area, residential or commercial, type of work, status (Quoted, Won, On site, Handed over, Defects period, Closed, Lost), contract sum, start, planned finish, handover, defects period.
- Quotes become projects: the quote total becomes the contract sum and the quote's estimated costs become the budget.
- Residential billing: payment stages that must add up to 100%. Each stage is invoiced in one tap; the last stage takes whatever is left of the contract value, so approved variations are never missed.
- Commercial billing: valuations by percentage complete. Each one values the work done, holds back retention, deducts what was claimed before and creates the invoice. Retention is released in two halves or all at once.
- Variations: pending, approved or rejected; approved ones add to the contract value.
- Costs: logged against a project by heading and section, with supplier or subcontractor. They are direct costs in every report (Calc.facts and Calc.summarise), not running expenses.
- Budget against actual by heading, subcontractors with agreed price, paid and owed, and a forecast margin (larger of budget and cost so far; actual cost once handed over; no forecast without a budget).
- Site diary with weather, crew, progress and problems; site photos and drawings; snag list. Crew can write the diary, add photos and raise snags, and never see project money.
- One-tap WhatsApp progress update to the client.
- Home: Projects on Site. Needs Attention: stages past their due date, retention due back, projects over budget, projects past their planned finish.
- Reports: Project Performance (residential against commercial, margin by project, win rate).
- The browser copy of the calculation layer (public/calc.js) is now rebuilt from netlify/lib/calc.mjs on every conversion.

## Purchase orders, crew timesheets and scheduled alerts

- Purchase orders on each project: numbered PO-0001 onwards, supplier, what is ordered, value, heading, needed-by date. Open orders count as committed cost in the budget table and the forecast margin. "Received" turns an order into a project cost at the amount actually charged; deleting that cost reopens the order. "Send" opens WhatsApp to the supplier with the order details.
- Log labour: one sheet per day per project, with each crew member's half or full day and day rate (the last rate is filled in). Each line becomes a labour cost on the project and is added to what that person is owed under Crew & Pay. The same person cannot be logged twice on one project for one day.
- Morning phone notifications now also cover: payment stages due, retention due back after the defects period, late deliveries, projects finishing in a week or past their planned finish, projects over budget (Mondays), bins to collect today, and machine services due by engine hours. Crew get the bins and machine alerts, never project money.

## One app for NV Construction and Cozy Apartments

NV Construction and Cozy Apartments are one business, so they share one set of books. Apartment income is the fourth line of business, Apartments, in every report.

- Brand: black and gold from NV's new logo. Apartment documents (rent invoices, receipts, tenancy agreements, booking confirmations) use the Cozy Apartments name in teal and sand.
- Units: name, type, bedrooms, most guests, long-term or short stays, usual rent, nightly rate and deposit.
- Tenancies: tenant details and ID, start and optional end date, rent and due day, deposit, what is included, occupants, pets, special terms. A unit cannot be let and booked for a short stay at the same time.
- Tenancy agreement: plain-English residential agreement filled in from the tenancy and Apartment Settings, produced as a PDF and shared from the phone (WhatsApp, email or print). Tenant and landlord sign with a finger on the phone; the wording is fixed at the first signature and signed terms cannot be edited. A witness line is included for paper signing.
- Rent: "Raise rent" creates one invoice per tenancy for the month, never twice; part months are charged by the day. Rent arrears are overdue apartment invoices, with statements, reminders and receipts as for any invoice.
- Deposits: recorded separately and never counted as income. Ending a tenancy records what was returned; anything kept becomes a paid invoice.
- Short stays: bookings by unit and date with nightly rate, cleaning fee and source (direct, WhatsApp, Airbnb, Booking.com); overlapping bookings are refused; one-tap invoice; booking confirmation PDF with house rules. A two-week occupancy calendar shows every unit.
- Repairs: reported by anyone (crew included), done by NV Construction; labour and materials count as Apartments costs.
- Home and Needs Attention: occupancy, arrivals and departures, arrears, urgent repairs, rent not yet raised, unsigned agreements and tenancies ending.
- Apartment Settings: trading name, landlord's legal name, address, notice period, deposit return days, late fee, check-in and check-out times, cancellation days, house rules and extra agreement terms.

## Taking payments, and growing the apartment business

- Payment methods everywhere: Cash, Local bank transfer, International transfer, Card, Cheque, Other. Each payment keeps its receipt number, cheque number or bank reference.
- Record a payment (Cozy Apartments overview, a tenancy, or a short stay): pick the tenant or guest, enter the amount and how it was paid. A tenant's payment pays off the oldest rent first and can cover several months; anything over what is owed is held as credit and used automatically when the next rent is raised. A guest's payment goes against the stay's invoice, which is created first if needed. The receipt opens straight away, ready to send by WhatsApp or email.
- How Customers Pay (Manage): local bank details from Business Settings, plus SWIFT/BIC, bank address, the US-dollar correspondent bank and a note for payers abroad, and whether and where cash is accepted. These appear in section 4A of every tenancy agreement and in the payment instructions on invoices and statements.
- Buildings: units belong to a building with its own name and address (used on that building's tenancy agreements). Existing units go into a first building automatically. The overview groups units by building.
- Add units in bulk: up to 200 at a time, numbered in sequence (Unit 25 to Unit 36, or V1 to V12), with a starting rent, nightly rate, deposit and type. Names already in use are refused with a clear list.
- Crew never see bank details or record payments.


## Two businesses, website bookings, Airbnb and Booking.com

- The menu switches between NV Construction, Cozy Apartments and Both businesses. Each opens in its own colours with its own bottom bar: NV has Home, Projects, Reports and Manage; Cozy has Home, Units, Reports and Manage; Both has Overview, Invoices, Reports and Manage.
- Every screen, invoice list and report shows only the business on screen. Expenses carry the business they belong to.
- Both businesses (owner and managers): revenue, costs and profit of each, the combined total, repairs NV did for Cozy at cost, and what needs a decision.
- Cozy Home: occupancy tonight, rent collected, net operating income, arrears, new website requests, arrivals and departures, payouts to enter, booking site status and open repairs.
- Website Requests: stay bookings, rental enquiries, building and hire enquiries sent from the website, ready to answer on WhatsApp. "Book it" offers only units free on those dates and creates the stay.
- Booking Sites: each unit's Airbnb and Booking.com export links, read every 30 minutes. New bookings are added, moved dates updated, bookings removed from a site cancelled; a link that cannot be read never cancels anything, and our own bookings echoed back by the other site are ignored. Each unit has its own calendar link to give the sites so they close nights booked elsewhere.
- Site bookings count as income from check-in, estimated from the nightly rate. Enter payout records what the guest paid as income and what the site kept as a booking site commission.
- Occupancy and Revenue report: occupancy, average nightly rate, income per available unit night, each booking site after commission, and each unit.
- Business Access (owner): each person works in NV Construction, Cozy Apartments or both. They are sent nothing from the other business and cannot change it.


## Staff duties, site tools, turnovers, payroll and the tenant app

- Duties (Manage, Business Access): Office and accounts, Project manager, Site foreman, Crew for NV Construction; Property manager, Front desk, Maintenance, Cleaner for Cozy Apartments. A duty sets the business, the access level and the bottom bar. The foreman lands on Projects; the cleaner on Turnovers; maintenance on Repairs. The front desk takes bookings and payments but is sent no costs, profit or payroll, and the server refuses cost, settings, rent-raising and payroll changes from that duty.
- Programme (project tab): tasks with working days and what each waits for. The timeline, the critical path, the forecast finish (unfinished work is planned from today) and the next two weeks are worked out. Crew can update progress; the foreman and office can add tasks. A task cannot be made to wait for itself.
- Site log (project tab): weather, people on site, hours lost, who was there, work done, deliveries, machines and hours, visitors, toolbox talk, problems, and sliders that move each task on the programme.
- Quality and safety (project tab): inspections with results, questions (RFIs) numbered RFI-01 onwards with due dates and answers, toolbox talks, near misses, incidents, permits with expiry dates, and days since the last incident.
- Turnovers and Cleaning: every guest check-out in the next week with the next arrival, a checklist the cleaner ticks off, notes, and a link to report damage. Cozy Home shows today's cleans.
- Payroll (Manage, both businesses): people paid from timesheets or a set wage, NIS (2026: 6.5% employee and 7.5% employer on up to EC$5,200 a month; 7% and 8% from 1 January 2027; the owner can override), PAYE at the rate the accountant gives, other deductions, net pay. Paying a run records wages and employer NIS as costs of the right business and settles what timesheet crew are owed. The BOSVG direct deposit file is a CSV with the columns BOSVG lists for ECACH EFT (employee name, account number, amount, account type DDA or SAV, routing/transit number, reference, effective date). Payslips as PDFs.
- Tenant app: invite a tenant from their tenancy. They see only their own unit, rent, balance, receipts, agreement, notices and repairs; they can report a problem and say they have paid. The office confirms the payment in one tap (Manage, Tenants and Notices), which records it against their rent.
- How Customers Pay: a card payment link (from BOSVG Merchant iServices once set up) shows as Pay by card in the tenant app.


## Booking and paying on the website

- The website's Book your stay panel asks the app what is free for the dates and number of guests, by apartment type, with the price per night, cleaning fee and total. Unit names and guests are never given out.
- Reserve: the cheapest free unit of that type is held for the guest for a set time (24 hours unless changed) and invoiced. The nights are closed straight away, including on Airbnb and Booking.com at their next check.
- The guest is shown the reference, the amount to pay (in full, or a deposit percentage), bank transfer details for local and overseas payments, the card payment link if one is set, and an "I have paid" button.
- In the app (Cozy Home and Needs Attention): website bookings waiting for payment, with the guest's payment reference if they have sent one. "Payment received" records the payment and confirms the booking; "Release" frees the nights. Unpaid holds are released automatically every 30 minutes once their time runs out, and their invoices withdrawn.
- Settings (Manage, Booking Sites): website booking on or off, hold time, deposit percentage, cleaning fee, shortest stay. Units marked long-term only or without a nightly rate are never offered.
