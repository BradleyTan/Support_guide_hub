import type { Metadata } from "next";
import { ChatView } from "@/components/chat/chat-view";
import { answersToday, getChats } from "@/lib/data";

export const metadata: Metadata = { title: "Accountant chat" };

export default async function ChatPage() {
  const [chats, today] = await Promise.all([getChats(), answersToday()]);
  return <ChatView chat={null} chats={chats} today={today} />;
}
