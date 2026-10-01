import type { ReleaseNote, Template } from "@/lib/types";

export const templates: Template[] = [
  {
    id: "T-01",
    kind: "Reply",
    title: "Issue resolved – confirmation",
    body: "Hi {contact},\n\nThe issue “{title}” has been resolved. Please log in again and let us know if everything looks correct.\n\nThank you.",
    tags: ["closing", "email"],
    uses: 42,
  },
  {
    id: "T-02",
    kind: "Reply",
    title: "Request for screenshot and version",
    body: "Hi {contact},\n\nTo check this quickly, could you send:\n1. A screenshot of the full error message\n2. Your AutoCount version\n3. Roughly when the problem started\n\nThank you.",
    tags: ["intake", "whatsapp"],
    uses: 67,
  },
  {
    id: "T-03",
    kind: "SQL",
    title: "Find journal lines without tax code on an account",
    body: "-- Sample only: confirm table and column names against your database before running\nSELECT DocNo, DocDate, Description, Amount\nFROM <gl_detail_table>\nWHERE AccNo = '<sst_payable_account>'\n  AND ISNULL(TaxCode, '') = '';",
    tags: ["sst", "gl", "read-only"],
    uses: 9,
  },
  {
    id: "T-04",
    kind: "Checklist",
    title: "Before upgrading AutoCount version",
    body: "- Full backup of every account book\n- Note custom report templates\n- Check Windows and SQL Server versions\n- Close all workstations\n- Test open, print and post after upgrade",
    tags: ["upgrade", "backup"],
    uses: 14,
  },
];

export const releaseNotes: ReleaseNote[] = [
  {
    id: "R-11",
    product: "AutoCount Accounting",
    version: "2.2",
    type: "Known issue",
    title: "e-Invoice rejects buyer when TIN and BRN mismatch",
    detail: "Seen at two sites. A customer data issue rather than software. Keep the TIN checklist handy.",
    guideIds: ["G-1046"],
  },
  {
    id: "R-10",
    product: "AutoCount POS",
    version: "2.2",
    type: "Note",
    title: "Outlet sync credentials after router change",
    detail: "Sync stops with 401 after network changes at the outlet.",
    guideIds: ["G-1048"],
  },
  {
    id: "R-09",
    product: "AutoCount Accounting",
    version: "2.1",
    type: "Fix",
    title: "Costing recalculation after backdated GRN",
    detail: "Recalculate stock costing after backdated entries.",
    guideIds: ["G-1045"],
  },
];
