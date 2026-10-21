import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const STOCK: StarterArticle[] = [
  {
    slug: "stock-costing-methods",
    version: 1,
    title: "Stock costing methods (FIFO, weighted average)",
    category: "Stock",
    tellCustomer:
      "When you buy the same item at different prices, the costing method decides what cost is used when you sell it. FIFO assumes the oldest stock is sold first; weighted average uses the average cost of everything in stock. The method changes your cost of sales and profit, so choose one and keep it.",
    whatItIs:
      "FIFO (first in, first out): sold units take the cost of the earliest purchases still in stock; closing stock is valued at recent prices. Weighted average: each sale takes the average cost of all units on hand. In rising prices FIFO gives a lower cost of sales (higher profit) than weighted average. Changing method later affects comparisons and needs the accountant's agreement.",
    example:
      "Bought 10 units at RM 10 and then 10 units at RM 14. You sell 10.\n• FIFO: cost of sales = 10 × RM 10 = RM 100; closing stock = 10 × RM 14 = RM 140.\n• Weighted average: average RM 12 → cost of sales RM 120; closing stock RM 120.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Changing the costing method in the middle of the year.",
      "Negative stock (selling before the purchase is keyed in), which distorts the cost used.",
      "Wrong purchase prices keyed in, which flow straight into cost of sales.",
    ],
    related: ["stock-valuation", "stock-take-and-adjustment", "profit-and-loss"],
    sources: [SRC.inventory, SRC.periodicVsPerpetual],
  },
  {
    slug: "stock-take-and-adjustment",
    version: 1,
    title: "Stock take and stock adjustment",
    category: "Stock",
    tellCustomer:
      "A stock take is physically counting what's on your shelves and comparing it with what the system says. If they differ because of damage, loss or counting errors, you record a stock adjustment so the system matches reality. Most businesses do a full count at least at year-end.",
    whatItIs:
      "Count each item, compare with the system quantity, investigate big differences, then post an adjustment: a shortage reduces stock (Dr Stock loss / write-off expense, Cr Stock) and a surplus increases it. Under a periodic inventory system, the counted closing stock value is keyed in for the period instead.",
    example:
      "System shows 100 cartons at RM 20; the count finds 96. Adjust −4 cartons: Dr Stock loss RM 80, Cr Stock RM 80.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Counting while goods are still being delivered or sold, so the count doesn't match any point in time.",
      "Adjusting without investigating large or repeated differences (possible theft or wrong units).",
      "Posting the adjustment in the wrong period.",
    ],
    related: ["stock-valuation", "stock-costing-methods", "year-end-closing"],
    sources: [SRC.inventory, SRC.periodicStockValue, SRC.stockOpeningBalance],
  },
  {
    slug: "stock-valuation",
    version: 1,
    title: "Stock valuation",
    category: "Stock",
    tellCustomer:
      "Stock valuation is the total value of the goods you still hold, based on their cost. It appears as an asset in the Balance Sheet and decides your cost of sales in Profit and Loss. If stock is worth less than it cost (damaged or outdated), it should be written down.",
    whatItIs:
      "Value = quantity on hand × cost (using your costing method). Accounting standards require stock at the lower of cost and net realisable value (what it can be sold for, less selling costs). In AutoCount Cloud Accounting, with a periodic inventory system you key in the closing stock value each month; with a perpetual system the system keeps it live.",
    example:
      "Closing stock 500 units at RM 12 cost = RM 6,000. 50 of them are damaged and can only be sold for RM 4 each → write down 50 × (RM 12 − RM 4) = RM 400. Stock value becomes RM 5,600.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Closing stock in Profit and Loss not matching the stock value report, often because the periodic stock value wasn't updated.",
      "Keeping obsolete stock at full cost year after year.",
    ],
    related: ["stock-costing-methods", "stock-take-and-adjustment", "balance-sheet", "profit-and-loss"],
    sources: [SRC.periodicStockValue, SRC.periodicVsPerpetual, SRC.closingStockPl, SRC.inventory],
  },
];
