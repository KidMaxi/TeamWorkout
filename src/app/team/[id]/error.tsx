"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/lib/error-card";

/** A failing team page keeps the team header and navigation; only the content area offers a retry. */
export default function TeamError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorCard reset={reset} />;
}
