# Accounting scenarios: approved expected results

Generated from the scenario calculator's default inputs. **All entries approved by the user on 1 Oct 2026.** The tests lock these figures: any change to the calculations makes the tests fail until this file is deliberately updated (`npx vitest run -u`), and a changed entry needs approving again.

Amounts in RM. AutoCount menu paths are not confirmed and are always marked “needs verification” in the app.

## Customer pays a deposit before the invoice

*Sales & receivables · `customer-deposit`*

**Inputs:** ABC Sdn Bhd paid a deposit of RM 5,000.00 before any invoice was issued.

**2026-08-01 — Deposit received**

| Account | Dr | Cr |
|---|--:|--:|
| Bank | 5000.00 |  |
| Customer deposit (liability) |  | 5000.00 |
| **Total** | **5000.00** | **5000.00** |

- [x] Approved

## Apply a customer deposit to the invoice

*Sales & receivables · `apply-deposit`*

**Inputs:** A deposit of RM 5,000.00 is applied to an invoice of RM 21,600.00.

**2026-08-15 — Apply deposit to invoice**

| Account | Dr | Cr |
|---|--:|--:|
| Customer deposit (liability) | 5000.00 |  |
| Trade debtor |  | 5000.00 |
| **Total** | **5000.00** | **5000.00** |

- [x] Approved

## Invoice for a taxable service (service tax)

*Tax · `service-tax-invoice`*

**Inputs:** Service invoice of RM 20,000.00 plus 8% service tax (RM 1,600.00), total RM 21,600.00.

**2026-08-15 — Service invoice with service tax**

| Account | Dr | Cr |
|---|--:|--:|
| Trade debtor | 21600.00 |  |
| Service revenue |  | 20000.00 |
| Service tax payable |  | 1600.00 |
| **Total** | **21600.00** | **21600.00** |

- [x] Approved

## Invoice for taxable goods (sales tax)

*Tax · `sales-tax-invoice`*

**Inputs:** Goods sold for RM 10,000.00 plus 10% sales tax (RM 1,000.00); cost RM 6,000.00.

**2026-09-01 — Sales invoice with sales tax**

| Account | Dr | Cr |
|---|--:|--:|
| Trade debtor | 11000.00 |  |
| Sales |  | 10000.00 |
| Sales tax payable |  | 1000.00 |
| **Total** | **11000.00** | **11000.00** |

**2026-09-01 — Cost of goods sold**

| Account | Dr | Cr |
|---|--:|--:|
| Cost of sales | 6000.00 |  |
| Inventory |  | 6000.00 |
| **Total** | **6000.00** | **6000.00** |

- [x] Approved

## Customer pays part of an invoice

*Sales & receivables · `partial-payment`*

**Inputs:** Customer paid RM 10,000.00 against RM 16,600.00 owed.

**2026-09-05 — Receipt from customer**

| Account | Dr | Cr |
|---|--:|--:|
| Bank | 10000.00 |  |
| Trade debtor |  | 10000.00 |
| **Total** | **10000.00** | **10000.00** |

- [x] Approved

## Credit note for returned goods

*Sales & receivables · `credit-note-return`*

**Inputs:** Goods worth RM 1,000.00 plus 10% tax returned; cost RM 600.00 back to stock.

**2026-09-24 — Credit note for returned goods**

| Account | Dr | Cr |
|---|--:|--:|
| Sales returns | 1000.00 |  |
| Sales tax payable | 100.00 |  |
| Trade debtor |  | 1100.00 |
| **Total** | **1100.00** | **1100.00** |

**2026-09-24 — Goods back into stock at cost**

| Account | Dr | Cr |
|---|--:|--:|
| Inventory | 600.00 |  |
| Cost of sales |  | 600.00 |
| **Total** | **600.00** | **600.00** |

- [x] Approved

## Credit note for a price reduction (no return)

*Sales & receivables · `credit-note-price`*

**Inputs:** Price reduced by RM 500.00 plus 8% tax (RM 40.00) after invoicing.

**2026-09-26 — Credit note: price reduction**

| Account | Dr | Cr |
|---|--:|--:|
| Sales returns & allowances | 500.00 |  |
| Tax payable | 40.00 |  |
| Trade debtor |  | 540.00 |
| **Total** | **540.00** | **540.00** |

- [x] Approved

## Refund a customer deposit

*Sales & receivables · `deposit-refund`*

**Inputs:** RM 1,000.00 of an unused deposit is refunded to the customer.

**2026-09-30 — Deposit refunded**

| Account | Dr | Cr |
|---|--:|--:|
| Customer deposit (liability) | 1000.00 |  |
| Bank |  | 1000.00 |
| **Total** | **1000.00** | **1000.00** |

- [x] Approved

## Contra: set off what a customer owes against what you owe them

*Sales & receivables · `contra`*

**Inputs:** Lim Brothers: RM 5,000.00 set off between a receivable of RM 8,000.00 and a payable of RM 5,000.00.

**2026-09-20 — Contra with Lim Brothers**

| Account | Dr | Cr |
|---|--:|--:|
| Trade creditor – Lim Brothers | 5000.00 |  |
| Trade debtor – Lim Brothers |  | 5000.00 |
| **Total** | **5000.00** | **5000.00** |

- [x] Approved

## Supplier invoice that includes SST

*Purchases & payables · `purchase-invoice-sst`*

**Inputs:** Supplier invoice of RM 2,000.00 plus 8% SST (RM 160.00), charged to Professional fees.

**2026-09-10 — Supplier invoice incl. SST**

| Account | Dr | Cr |
|---|--:|--:|
| Professional fees | 2160.00 |  |
| Trade creditor |  | 2160.00 |
| **Total** | **2160.00** | **2160.00** |

- [x] Approved

## Pay a supplier and take an early-payment discount

*Purchases & payables · `supplier-payment-discount`*

**Inputs:** Supplier invoice of RM 10,000.00 settled early with a 2% discount (RM 200.00).

**2026-09-15 — Supplier payment with discount**

| Account | Dr | Cr |
|---|--:|--:|
| Trade creditor | 10000.00 |  |
| Bank |  | 9800.00 |
| Discount received |  | 200.00 |
| **Total** | **10000.00** | **10000.00** |

- [x] Approved

## Pay a non-resident with withholding tax

*Tax · `withholding-tax`*

**Inputs:** Non-resident invoice of RM 20,000.00 with 10% withholding tax (RM 2,000.00) paid to LHDN.

**2026-09-12 — Non-resident invoice with WHT**

| Account | Dr | Cr |
|---|--:|--:|
| Technical services | 20000.00 |  |
| Trade creditor – non-resident |  | 18000.00 |
| Withholding tax payable (LHDN) |  | 2000.00 |
| **Total** | **20000.00** | **20000.00** |

- [x] Approved

## Customer pays a foreign-currency invoice (realised gain/loss)

*Foreign currency · `fx-receipt`*

**Inputs:** USD 2,000.00 received at 4.38 against an invoice booked at 4.4.

**2026-09-05 — Receipt USD 2,000.00 @ 4.38**

| Account | Dr | Cr |
|---|--:|--:|
| Bank – USD | 8760.00 |  |
| Trade debtor |  | 8800.00 |
| Realised exchange loss | 40.00 |  |
| **Total** | **8800.00** | **8800.00** |

- [x] Approved

## Pay a foreign-currency supplier invoice (realised gain/loss)

*Foreign currency · `fx-supplier-payment`*

**Inputs:** USD 3,000.00 paid at 4.42 against a supplier invoice booked at 4.35.

**2026-09-18 — Payment USD 3,000.00 @ 4.42**

| Account | Dr | Cr |
|---|--:|--:|
| Trade creditor | 13050.00 |  |
| Bank – USD |  | 13260.00 |
| Realised exchange loss | 210.00 |  |
| **Total** | **13260.00** | **13260.00** |

- [x] Approved

## Month-end revaluation of a foreign-currency balance

*Foreign currency · `fx-revaluation`*

**Inputs:** Receivable of USD 2,400.00 restated from 4.4 to 4.35.

**2026-09-30 — Revalue USD 2,400.00 to 4.35**

| Account | Dr | Cr |
|---|--:|--:|
| Unrealised exchange loss | 120.00 |  |
| Trade debtor |  | 120.00 |
| **Total** | **120.00** | **120.00** |

- [x] Approved

## Foreign deposit → invoice with SST → partial payment → month-end

*Foreign currency · `usd-deposit-sst-partial`*

**Inputs:** USD 1,000.00 deposit at 4.45; invoice USD 5,000.00 + 8% service tax at 4.4; USD 2,000.00 paid at 4.38; month-end rate 4.35.

**2026-08-01 — Deposit received USD 1,000.00 @ 4.45**

| Account | Dr | Cr |
|---|--:|--:|
| Bank – USD | 4450.00 |  |
| Customer deposit (liability) |  | 4450.00 |
| **Total** | **4450.00** | **4450.00** |

**2026-08-15 — Invoice USD 5,000.00 + 8% service tax @ 4.4**

| Account | Dr | Cr |
|---|--:|--:|
| Trade debtor | 23760.00 |  |
| Service revenue |  | 22000.00 |
| Service tax payable |  | 1760.00 |
| **Total** | **23760.00** | **23760.00** |

**2026-08-15 — Apply deposit USD 1,000.00 to the invoice**

| Account | Dr | Cr |
|---|--:|--:|
| Customer deposit (liability) | 4450.00 |  |
| Trade debtor |  | 4400.00 |
| Realised exchange gain |  | 50.00 |
| **Total** | **4450.00** | **4450.00** |

**2026-09-05 — Partial payment USD 2,000.00 @ 4.38**

| Account | Dr | Cr |
|---|--:|--:|
| Bank – USD | 8760.00 |  |
| Trade debtor |  | 8800.00 |
| Realised exchange loss | 40.00 |  |
| **Total** | **8800.00** | **8800.00** |

**2026-09-30 — Revalue open USD 2,400.00 from 4.4 to 4.35**

| Account | Dr | Cr |
|---|--:|--:|
| Unrealised exchange loss | 120.00 |  |
| Trade debtor |  | 120.00 |
| **Total** | **120.00** | **120.00** |

> Judgement: Under IC Interpretation 22, the prepaid part can be measured at the deposit-date rate instead, which moves the RM 50.00 difference from exchange gain/loss into revenue. Confirm the company's policy.

- [x] Approved

## Write off damaged or missing stock

*Stock · `stock-write-off`*

**Inputs:** 47 units of HW-220 at RM 50.00 each are written off (RM 2,350.00).

**2026-09-12 — Write off 47 × HW-220**

| Account | Dr | Cr |
|---|--:|--:|
| Stock write-off (expense) | 2350.00 |  |
| Inventory |  | 2350.00 |
| **Total** | **2350.00** | **2350.00** |

- [x] Approved

## Stock take finds more stock than the system

*Stock · `stock-surplus`*

**Inputs:** 10 extra units of HW-118 at RM 25.00 are found at stock take (RM 250.00).

**2026-09-12 — Stock surplus 10 × HW-118**

| Account | Dr | Cr |
|---|--:|--:|
| Inventory | 250.00 |  |
| Stock adjustment (cost of sales) |  | 250.00 |
| **Total** | **250.00** | **250.00** |

- [x] Approved

## Accrue an expense at period end (and reverse it)

*Period-end · `accrual`*

**Inputs:** Audit fee of RM 12,000.00 accrued at 2026-12-31 and reversed on 2027-01-01.

**2026-12-31 — Accrue Audit fee**

| Account | Dr | Cr |
|---|--:|--:|
| Audit fee | 12000.00 |  |
| Accrued expenses |  | 12000.00 |
| **Total** | **12000.00** | **12000.00** |

**2027-01-01 — Reverse Audit fee accrual**

| Account | Dr | Cr |
|---|--:|--:|
| Accrued expenses | 12000.00 |  |
| Audit fee |  | 12000.00 |
| **Total** | **12000.00** | **12000.00** |

- [x] Approved

## Prepaid expense (e.g. annual insurance) and monthly release

*Period-end · `prepayment`*

**Inputs:** RM 2,400.00 paid for 12 months; 3 months used by period end.

**2026-07-01 — Pay Insurance in advance**

| Account | Dr | Cr |
|---|--:|--:|
| Prepaid insurance | 2400.00 |  |
| Bank |  | 2400.00 |
| **Total** | **2400.00** | **2400.00** |

**2026-09-30 — Release 3 of 12 months**

| Account | Dr | Cr |
|---|--:|--:|
| Insurance | 600.00 |  |
| Prepaid insurance |  | 600.00 |
| **Total** | **600.00** | **600.00** |

- [x] Approved

## Depreciation for the period (straight line)

*Period-end · `depreciation`*

**Inputs:** Office laptop: cost RM 6,000.00, 3-year life, 1 month(s) of depreciation.

**2026-09-30 — Depreciation – Office laptop**

| Account | Dr | Cr |
|---|--:|--:|
| Depreciation expense | 166.67 |  |
| Accumulated depreciation |  | 166.67 |
| **Total** | **166.67** | **166.67** |

- [x] Approved

## Write off a bad debt

*Period-end · `bad-debt`*

**Inputs:** RM 3,240.00 owed by XYZ Trading is written off as uncollectible.

**2026-09-30 — Bad debt – XYZ Trading**

| Account | Dr | Cr |
|---|--:|--:|
| Bad debts written off | 3240.00 |  |
| Trade debtor |  | 3240.00 |
| **Total** | **3240.00** | **3240.00** |

- [x] Approved

## Allowance for doubtful debts (impairment)

*Period-end · `impairment`*

**Inputs:** Expected loss 4% on RM 50,000.00 = RM 2,000.00; allowance already RM 1,000.00.

**2026-12-31 — Increase allowance for impairment**

| Account | Dr | Cr |
|---|--:|--:|
| Impairment loss on receivables | 1000.00 |  |
| Allowance for impairment |  | 1000.00 |
| **Total** | **1000.00** | **1000.00** |

> Judgement: The loss rate is a judgement; base it on ageing and past collections and document it.

- [x] Approved

## Cash sale with 5-sen rounding

*Bank & cash · `cash-rounding`*

**Inputs:** Cash bill of RM 10.97 is rounded to RM 10.95.

**2026-09-30 — Cash sale with rounding**

| Account | Dr | Cr |
|---|--:|--:|
| Cash | 10.95 |  |
| Rounding adjustment | 0.02 |  |
| Sales |  | 10.97 |
| **Total** | **10.97** | **10.97** |

- [x] Approved

## Monthly payroll journal (EPF, SOCSO, EIS, PCB)

*Payroll · `payroll-journal`*

**Inputs:** Gross salaries RM 5,000.00; net pay RM 4,295.35 after EPF, SOCSO, EIS and PCB deductions.

**2026-09-30 — Payroll for the month**

| Account | Dr | Cr |
|---|--:|--:|
| Salaries and wages | 5000.00 |  |
| EPF – employer contribution | 650.00 |  |
| SOCSO – employer contribution | 86.65 |  |
| EIS – employer contribution | 9.90 |  |
| HRD levy | 50.00 |  |
| EPF payable |  | 1200.00 |
| SOCSO payable |  | 111.40 |
| EIS payable |  | 19.80 |
| PCB payable (LHDN) |  | 120.00 |
| HRD levy payable |  | 50.00 |
| Salaries payable (net pay) |  | 4295.35 |
| **Total** | **5796.55** | **5796.55** |

- [x] Approved

## Bank charges and interest from the bank statement

*Bank & cash · `bank-charges-interest`*

**Inputs:** Bank statement shows charges of RM 25.00 and interest of RM 12.40.

**2026-09-30 — Bank charges per statement**

| Account | Dr | Cr |
|---|--:|--:|
| Bank charges | 25.00 |  |
| Bank |  | 25.00 |
| **Total** | **25.00** | **25.00** |

**2026-09-30 — Interest earned per statement**

| Account | Dr | Cr |
|---|--:|--:|
| Bank | 12.40 |  |
| Interest income |  | 12.40 |
| **Total** | **12.40** | **12.40** |

- [x] Approved
