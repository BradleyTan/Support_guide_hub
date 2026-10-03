import type { Template } from "@/lib/types";

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
