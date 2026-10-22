"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { AnswerView } from "@/components/chat/answer-view";
import { ChatList } from "@/components/chat/chat-list";
import { Composer } from "@/components/chat/composer";
import { deleteChat, renameChat, restoreChat, saveTurn } from "@/app/(app)/chat/actions";
import { historyForGroq, unmaskAnswer, type ChatMessage } from "@/lib/accountant/chat";
import { askAccountant } from "@/lib/accountant/client";
import { autoMask, type MaskMap } from "@/lib/accountant/core/mask";
import type { ChatSummary } from "@/lib/data";

type Chat = { id: string; title: string; mask: MaskMap; messages: ChatMessage[] };

export function ChatView({ chat, chats, today }: { chat: Chat | null; chats: ChatSummary[]; today: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Turns answered in this visit but not yet in the server-rendered chat (shown while saving, or if saving failed).
  const [local, setLocal] = useState<ChatMessage[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat?.title ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, start] = useTransition();

  const messages = [...(chat?.messages ?? []), ...local.filter((l) => !chat?.messages.some((m) => m.id === l.id))];

  async function send(masked: string, map: MaskMap) {
    setBusy(true);
    setError(null);
    // Earlier turns are masked with the same map, so Groq sees the same placeholders throughout.
    let m = map;
    const history = historyForGroq(messages).map((t) => {
      const r = autoMask(t.content, m);
      m = r.map;
      return { role: t.role, content: r.text };
    });
    const res = await askAccountant({ message: masked, history, mask: m });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    const answer = unmaskAnswer(res.checked, res.mask);
    const now = new Date().toISOString();
    setLocal((l) => [
      ...l,
      { id: `local-q-${now}`, role: "user", content: text, answer: null, checked: false, createdAt: now },
      { id: `local-a-${now}`, role: "assistant", content: "", answer, checked: false, createdAt: now },
    ]);
    const saved = await saveTurn({ chatId: chat?.id ?? null, userText: text, answer, mask: res.mask });
    setBusy(false);
    if (!saved.ok) {
      toast.error(saved.error, { description: "The answer is shown here but wasn’t saved." });
      return;
    }
    setText("");
    setLocal([]);
    if (!chat) router.push(`/chat/${saved.data.chatId}`);
    else router.refresh();
  }

  function rename() {
    if (!chat) return;
    start(async () => {
      const res = await renameChat(chat.id, title);
      if (!res.ok) return void toast.error(res.error);
      setRenaming(false);
      router.refresh();
    });
  }

  function remove() {
    if (!chat) return;
    start(async () => {
      const res = await deleteChat(chat.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmDelete(false);
      toast.success("Chat moved to the bin", {
        description: "You can restore it from Settings within 30 days.",
        action: {
          label: "Undo",
          onClick: async () => {
            const back = await restoreChat(chat.id);
            if (back.ok) router.push(`/chat/${chat.id}`);
            else toast.error(back.error);
          },
        },
      });
      router.push("/chat");
    });
  }

  return (
    <>
      <PageHeader
        title={chat ? chat.title : "Accountant chat"}
        description={chat ? undefined : "Describe a customer’s accounting scenario. You get the reasoning and entries for you, and a reply for the customer."}
        actions={
          chat && (
            <>
              <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
                <Pencil /> Rename
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </Button>
            </>
          )
        }
        howItWorks={
          chat ? undefined : (
            <>
              Answers come from your guides first, then your Knowledge hub, then the AutoCount help centre, using Groq’s free AI. Names, IC and bank numbers are hidden before sending. Entries are checked to balance and menu paths are only
              shown to the customer when a checked source states them. Always check before relying on an answer.
            </>
          )
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className={chat ? "hidden lg:block" : undefined}>
          <ChatList chats={chats} currentId={chat?.id ?? null} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {chat && (
            <Link href="/chat" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
              <ArrowLeft className="size-4" /> All chats
            </Link>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[85%] rounded-xl bg-primary/10 px-4 py-2 text-sm break-words whitespace-pre-line">
                {m.content}
              </div>
            ) : (
              <AnswerView key={m.id} message={m} />
            ),
          )}
          <Composer text={text} onText={setText} mask={chat?.mask ?? {}} busy={busy || working} error={error} onSend={send} />
          <p className="text-xs text-muted-foreground">
            {today} {today === 1 ? "answer" : "answers"} today · Groq’s free plan allows roughly 30–40 a day.
          </p>
        </div>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input aria-label="Chat name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={rename} disabled={working || !title.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move this chat to the bin?</DialogTitle>
            <DialogDescription>You can restore it from Settings within 30 days. After that it’s removed for good.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={remove} disabled={working}>
              Move to bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
