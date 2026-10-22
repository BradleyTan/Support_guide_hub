import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { ChatSummary } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChatList({ chats, currentId }: { chats: ChatSummary[]; currentId: string | null }) {
  return (
    <nav aria-label="Your chats" className="flex min-w-0 flex-col gap-2">
      <ButtonLink href="/chat" variant={currentId ? "outline" : "default"} size="sm" className="w-fit">
        <Plus /> New chat
      </ButtonLink>
      {chats.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your saved chats will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                aria-current={c.id === currentId ? "page" : undefined}
                className={cn("block rounded-md px-2 py-1.5 text-sm hover:bg-muted", c.id === currentId && "bg-muted font-medium")}
              >
                <span className="line-clamp-2 break-words">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.updatedAt)} · {c.answerCount} {c.answerCount === 1 ? "answer" : "answers"}
                  {c.checkedCount > 0 && ` · ${c.checkedCount} checked`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
