import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Shown while the academy week overview is being prepared. */
export default function Loading() {
  return (
    <SkeletonPage className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <Bar w="6rem" h="0.75rem" />
      <Bar w="14rem" h="2.5rem" />
      <Bar w="100%" h="2.75rem" className="!rounded-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <CardSkel key={i} lines={1} />)}
      </div>
      <CardSkel lines={4} />
      <CardSkel lines={5} />
    </SkeletonPage>
  );
}
