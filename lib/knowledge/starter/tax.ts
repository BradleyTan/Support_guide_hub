import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

/** Tax rules change: every article states the date its facts were checked ("as of"). */
export const TAX: StarterArticle[] = [
  {
    slug: "sst",
    version: 1,
    title: "SST: sales tax vs service tax",
    category: "Tax",
    tellCustomer:
      "Malaysia's SST has two parts: sales tax on certain goods made or imported, and service tax on certain services. Only registered businesses charge it, and it is not claimable back like GST was. As of October 2026, service tax is mostly 8% and sales tax is 5% or 10%.",
    whatItIs:
      "As of October 2026 (checked against Customs and Ministry of Finance pages):\n• Service tax: 8% for most taxable services since 1 March 2024; some services such as food and beverage, telecommunications, parking and logistics remain at 6%.\n• Sales tax: 5% or 10% on taxable goods; from 1 July 2025 the sales tax rates were revised and the service tax scope expanded to more services.\nSST is charged by registered businesses only, and the tax charged is paid to Customs. Because there is no input tax claim, SST paid on purchases is part of the cost. Some service tax is due when payment is received (payment basis), which is why AutoCount Cloud Accounting has a Tax Payment Collection inquiry.",
    example:
      "A registered consultancy bills RM 10,000 for taxable services as of October 2026: service tax 8% = RM 800, invoice total RM 10,800. Dr Debtor RM 10,800, Cr Service income RM 10,000, Cr Service tax payable RM 800.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Charging SST when the business isn't registered, or using the old 6% rate for services that moved to 8%.",
      "Treating SST paid on purchases as claimable.",
      "Using a tax code that doesn't match the type of goods or service, so the SST return is wrong.",
    ],
    related: ["e-invoice-and-tin", "invoice-vs-cash-sale", "purchase-invoice"],
    sources: [SRC.mysst, SRC.mofSst2025, SRC.taxPaymentCollection],
  },
  {
    slug: "e-invoice-and-tin",
    version: 1,
    title: "e-Invoice and TIN",
    category: "Tax",
    tellCustomer:
      "An e-Invoice is an invoice sent electronically to LHDN through MyInvois, which checks and validates it. To issue one, you need the buyer's tax details, mainly their TIN (tax identification number). As of October 2026, it applies in phases by annual turnover, and small businesses below RM3 million are exempt.",
    whatItIs:
      "As of October 2026 (LHDN e-Invoice timeline and FAQs): implementation started 1 August 2024 for turnover above RM100 million, then 1 January 2025 (above RM25 million), 1 July 2025 (above RM5 million) and 1 January 2026 (up to RM5 million), with later dates for some smaller and new businesses. Within that last group, businesses with annual turnover below RM3 million are exempt if they meet LHDN's exemption criteria, so in practice it covers RM3 million to RM5 million. Each e-Invoice needs correct buyer details (TIN, registration number, address) and classification codes; consolidated e-Invoices can cover small sales to buyers who don't need one. Rules change often, so always check the latest LHDN guideline.",
    example:
      "You sell RM 5,000 to ABC Sdn Bhd. The invoice is submitted with ABC's TIN; LHDN validates it and returns a unique number and QR code to print on the invoice. If the TIN is wrong, submission fails with 'Buyer TIN is invalid' and you use the Search TIN function to correct it.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Wrong or missing buyer TIN, the most common submission error.",
      "Forgetting the tax entity setup for government or foreign customers.",
      "Cancelling or changing a validated e-Invoice instead of issuing a credit or debit note after the cancellation window.",
    ],
    related: ["sst", "credit-note-and-debit-note", "invoice-vs-cash-sale"],
    sources: [SRC.lhdnEInvoiceTimeline, SRC.lhdnEInvoiceFaq, SRC.eInvoiceSubmit, SRC.eInvoiceTinInvalid, SRC.eInvoiceTaxEntity, SRC.eInvoiceConsolidated],
  },
  {
    slug: "withholding-tax",
    version: 1,
    title: "Withholding tax",
    category: "Tax",
    tellCustomer:
      "Withholding tax applies when a Malaysian business pays certain amounts to a non-resident, such as interest, royalties or some service fees. You keep back part of the payment and pay it to LHDN instead. As of October 2026, common rates are 15% for interest and 10% for royalties and special classes of income like technical service fees.",
    whatItIs:
      "As of October 2026 (LHDN withholding tax page): interest to non-residents 15% (section 109), royalties 10% (section 109), special classes of income such as services and technical fees 10% (section 109B), and payments to non-resident public entertainers 15% (section 109A). The withheld amount is paid to LHDN within one month of paying or crediting the non-resident, using the relevant form. Tax treaties can lower some rates; check with the tax agent.",
    example:
      "You pay a Singapore consultant RM 10,000 for technical services performed in Malaysia, as of October 2026: withhold 10% (RM 1,000), pay the consultant RM 9,000, and pay RM 1,000 to LHDN within one month. Entry: Dr Consultancy fee RM 10,000, Cr Bank RM 9,000, Cr Withholding tax payable RM 1,000.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Paying the full amount to the non-resident and forgetting to withhold.",
      "Paying LHDN late, which leads to penalties.",
      "Recording only the net amount paid as the expense, instead of the full fee.",
    ],
    related: ["supplier-payment", "purchase-invoice", "foreign-currency-gain-loss"],
    sources: [SRC.lhdnWithholding],
  },
];
