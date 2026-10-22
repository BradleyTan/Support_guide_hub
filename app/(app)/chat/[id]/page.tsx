import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { answersToday, getChat, getChats } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const chat = await getChat((await params).id);
  return { title: chat?.title ?? "Accountant chat" };
}

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const [chat, chats, today] = await Promise.all([getChat(id), getChats(), answersToday()]);
  if (!chat) notFound();
  // key: a fresh view (empty box, no leftover turns) for each chat.
  return <ChatView key={chat.id} chat={chat} chats={chats} today={today} />;
}
