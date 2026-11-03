import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Shown while a top-level page (team list, profile, help, or the team shell on first entry) is being prepared. */
export default function Loading() {
  return (
    <SkeletonPage className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 pb-10 pt-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Bar w="2rem" h="2rem" className="!rounded-full" />
        <Bar w="9rem" h="1.5rem" />
      </div>
      <CardSkel lines={1} />
      <CardSkel lines={1} />
      <CardSkel lines={2} />
    </SkeletonPage>
  );
}
