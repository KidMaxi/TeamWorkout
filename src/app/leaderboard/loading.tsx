import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Shown while the club records are being prepared. */
export default function Loading() {
  return (
    <SkeletonPage className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <Bar w="6rem" h="0.75rem" />
      <Bar w="12rem" h="2.5rem" />
      <Bar w="100%" h="2.75rem" className="!rounded-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <CardSkel key={i} lines={2} />)}
      </div>
      <CardSkel lines={5} />
    </SkeletonPage>
  );
}
