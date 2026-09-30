import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <LoginForm next={typeof next === "string" ? next : "/"} linkError={error === "confirm" || error === "reset" ? error : undefined} />
    </main>
  );
}
