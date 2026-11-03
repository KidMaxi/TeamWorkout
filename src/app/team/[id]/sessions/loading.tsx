import { Bar, CardSkel, SkeletonPage, TabsSkel } from "@/lib/skeleton";

/** Sessions list and calendar: tab strip plus session cards. */
export default function Loading() {
  return (
    <SkeletonPage className="flex flex-col gap-6">
      <TabsSkel n={2} />
      <div className="flex flex-col gap-3">
        <Bar w="6rem" h="0.75rem" />
        <CardSkel lines={2} />
        <CardSkel lines={2} />
        <CardSkel lines={2} />
      </div>
    </SkeletonPage>
  );
}
