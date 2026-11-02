import { notFound } from "next/navigation";
import { Harness } from "./Harness";

/** Test harness for e2e/offline-runner.mjs. 404 unless E2E_HARNESS=1. */
export default async function Page({ searchParams }: { searchParams: Promise<{ persist?: string }> }) {
  if (process.env.E2E_HARNESS !== "1") notFound();
  const { persist } = await searchParams;
  return <Harness persist={persist === "1"} />;
}
