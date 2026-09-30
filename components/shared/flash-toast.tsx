"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/** Shows a one-off success message after a redirect, then removes the query string so it doesn't repeat. */
export function FlashToast({ message }: { message: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    toast.success(message);
    router.replace(pathname, { scroll: false });
  }, [message, pathname, router]);
  return null;
}
