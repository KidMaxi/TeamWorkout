import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Members: invite card followed by one card per member. */
export default function Loading() {
  return (
    <SkeletonPage className="flex flex-col gap-6">
      <CardSkel lines={2} hero />
      <div className="flex flex-col gap-3">
        <Bar w="5rem" h="0.75rem" />
        <CardSkel lines={2} />
        <CardSkel lines={2} />
      </div>
    </SkeletonPage>
  );
}
