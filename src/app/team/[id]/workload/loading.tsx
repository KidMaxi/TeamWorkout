import { Bar, CardSkel, SkeletonPage, TabsSkel } from "@/lib/skeleton";

/** Workload board: tab strip, week switcher bar and one card per athlete row. */
export default function Loading() {
  return (
    <SkeletonPage>
      <TabsSkel n={2} />
      <Bar h="2.75rem" className="!rounded-2xl" />
      <CardSkel lines={2} />
      <CardSkel lines={2} />
      <CardSkel lines={2} />
    </SkeletonPage>
  );
}
