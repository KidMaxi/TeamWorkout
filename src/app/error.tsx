"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/lib/error-card";

/** Friendly fallback when a page fails to load (typically a dropped connection). */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <ErrorCard reset={reset} home />
    </main>
  );
}
