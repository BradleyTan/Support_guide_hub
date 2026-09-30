"use client";

import { useState } from "react";
import { Copy, FileDown, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import type { Analysis, Guide } from "@/lib/types";

type Lang = "en" | "ms" | "zh";
type Channel = "email" | "whatsapp";

const langLabel: Record<Lang, string> = { en: "English", ms: "Bahasa Malaysia", zh: "中文" };

/** Prototype drafts for G-1051. The real version generates these from any guide or analysis. */
const drafts: Record<Lang, Record<Channel, string>> = {
  en: {
    email:
      "Subject: AutoCount connection issue: resolved\n\nDear Ms Aisyah,\n\nThank you for your patience this morning.\n\nThe workstations could not connect because last weekend's Windows update changed the server's network setting, and the firewall then blocked the database connection. We have:\n\n1. Set the server's network back to Private\n2. Re-opened the ports AutoCount's database uses\n3. Confirmed the database service starts automatically\n\nAll workstations can now open the account book. To avoid a repeat, we suggest pausing major Windows updates on the server PC and letting us know before installing them.\n\nPlease reply if anything still looks wrong.\n\nBest regards,",
    whatsapp:
      "Hi Ms Aisyah 👋 The AutoCount issue is fixed. The weekend Windows update changed the server's network setting and blocked the database. We've reset it and all PCs can log in now ✅\n\nTip: please pause big Windows updates on the server PC and tell us before installing. Thanks!",
  },
  ms: {
    email:
      "Subjek: Masalah sambungan AutoCount: telah diselesaikan\n\nPuan Aisyah,\n\nTerima kasih atas kesabaran puan pagi tadi.\n\nKomputer pengguna tidak dapat disambungkan kerana kemas kini Windows pada hujung minggu lalu telah mengubah tetapan rangkaian server, dan firewall kemudian menyekat sambungan pangkalan data. Kami telah:\n\n1. Menetapkan semula rangkaian server kepada Private\n2. Membuka semula port yang digunakan oleh pangkalan data AutoCount\n3. Memastikan servis pangkalan data bermula secara automatik\n\nSemua komputer kini boleh membuka buku akaun. Untuk mengelakkan masalah berulang, kami cadangkan kemas kini besar Windows pada komputer server ditangguhkan dan maklumkan kepada kami sebelum memasangnya.\n\nSila balas jika masih ada masalah.\n\nSekian, terima kasih.",
    whatsapp:
      "Hi Puan Aisyah 👋 Masalah AutoCount sudah selesai. Kemas kini Windows hujung minggu lalu telah mengubah tetapan rangkaian server dan menyekat pangkalan data. Kami sudah tetapkan semula dan semua PC boleh log masuk sekarang ✅\n\nTip: sila tangguhkan kemas kini besar Windows pada PC server dan maklumkan kami dahulu. Terima kasih!",
  },
  zh: {
    email:
      "主题：AutoCount 连接问题已解决\n\nAisyah 女士您好，\n\n感谢您今早的耐心等待。\n\n各工作站无法连接，是因为上周末的 Windows 更新更改了服务器的网络设置，导致防火墙拦截了数据库连接。我们已经：\n\n1. 将服务器网络重新设为「专用」(Private)\n2. 重新开放 AutoCount 数据库所需的端口\n3. 确认数据库服务会自动启动\n\n现在所有工作站都能正常打开账簿。为避免再次发生，建议暂停服务器电脑的大型 Windows 更新，安装前请先通知我们。\n\n如仍有任何问题，请随时回复。\n\n此致\n敬礼",
    whatsapp:
      "Aisyah 女士您好 👋 AutoCount 的问题已解决。周末的 Windows 更新改了服务器网络设置，拦截了数据库。我们已重新设置，现在所有电脑都能登录 ✅\n\n提醒：请暂停服务器电脑的大型 Windows 更新，安装前先通知我们。谢谢！",
  },
};

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="inline-flex w-fit rounded-lg border bg-card p-0.5 text-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("h-7 rounded-md px-3 transition-colors", value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReplyGenerator({ guides, analyses, initialSource }: { guides: Guide[]; analyses: Analysis[]; initialSource?: string }) {
  const [source, setSource] = useState(initialSource ?? (guides[0] ? `guide:${guides[0].id}` : ""));
  const [lang, setLang] = useState<Lang>("en");
  const [channel, setChannel] = useState<Channel>("email");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(drafts.en.email);

  const sourceLabels = new Map<string, string>([
    ...guides.map((g) => [`guide:${g.id}`, `${g.id} · ${g.title}`] as const),
    ...analyses.map((a) => [`analysis:${a.id}`, `${a.id} · ${a.title}`] as const),
  ]);

  function generate(l = lang, c = channel) {
    setBusy(true);
    setTimeout(() => {
      setText(drafts[l][c]);
      setBusy(false);
    }, 700);
  }

  return (
    <>
      <PageHeader
        title="Reply generator"
        description="Turn a guide or an analysis into a polite, client-ready message, then copy it into Zoho Desk, email or WhatsApp."
        howItWorks={
          <>
            Claude Sonnet writes the reply from the guide’s cause and fix steps, in plain language for the client. Technical terms are kept to a minimum. If <strong>mask sensitive data</strong> is on in Settings, company names and IC or bank numbers are replaced before the text goes to the AI. You can edit the draft freely before copying.
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Based on</Label>
            <Select value={source} onValueChange={(v) => setSource(String(v))}>
              <SelectTrigger id="source" className="w-full bg-card">
                <SelectValue>{(v: string) => <span className="truncate">{sourceLabels.get(v)}</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Guides</SelectLabel>
                  {guides.map((g) => (
                    <SelectItem key={g.id} value={`guide:${g.id}`}>
                      {g.id} · {g.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Analyses</SelectLabel>
                  {analyses.map((a) => (
                    <SelectItem key={a.id} value={`analysis:${a.id}`}>
                      {a.id} · {a.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Segmented
            label="Channel"
            value={channel}
            onChange={(c) => {
              setChannel(c);
              generate(lang, c);
            }}
            options={[
              { value: "email", label: "Email" },
              { value: "whatsapp", label: "WhatsApp" },
            ]}
          />
          <Segmented
            label="Language"
            value={lang}
            onChange={(l) => {
              setLang(l);
              generate(l, channel);
            }}
            options={(Object.keys(langLabel) as Lang[]).map((l) => ({ value: l, label: langLabel[l] }))}
          />
          <p className="text-xs text-muted-foreground">Until AI replies are connected (Phase 6), this shows a sample reply about a SQL Server connection fix.</p>
        </div>

        <section aria-labelledby="draft-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="draft-h" className="font-medium">
              Draft
            </h2>
            <span className="text-xs text-muted-foreground">
              {langLabel[lang]} · {channel === "email" ? "Email" : "WhatsApp"} · polite, professional
            </span>
          </div>
          <div className="relative">
            <Label htmlFor="draft" className="sr-only">
              Reply draft
            </Label>
            <Textarea
              id="draft"
              value={source ? text : ""}
              onChange={(e) => setText(e.target.value)}
              rows={channel === "email" ? 20 : 8}
              placeholder="Choose a guide or analysis and the draft appears here."
              className={cn("bg-card leading-relaxed", busy && "opacity-40")}
              lang={lang === "zh" ? "zh" : lang}
            />
            {busy && (
              <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" /> Writing…
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(text);
                toast.success("Copied. Paste it into Zoho Desk or WhatsApp.");
              }}
            >
              <Copy /> Copy
            </Button>
            <Button variant="outline" onClick={() => generate()}>
              <RefreshCw /> Rewrite
            </Button>
            <Button variant="outline" onClick={() => toast("Saved to Templates (mock)")}>
              <Save /> Save as template
            </Button>
            <Button variant="outline" onClick={() => toast("Word export is mocked", { description: "The real version downloads a .docx with your letterhead." })}>
              <FileDown /> Word (.docx)
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
