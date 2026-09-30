"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-xl flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.05] p-5 sm:flex-row">
      <AlertTriangle className="size-5 shrink-0 text-destructive" />
      <div className="flex-1">
        <h1 className="font-medium">Something went wrong loading this page</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your data is safe. This is usually a connection problem. Try again, and if it keeps happening, check your internet connection.</p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
