import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Logged sets overview: header plus athlete cards. */
export default function Loading() {
  return (
    <SkeletonPage className="flex flex-col gap-4">
      <Bar w="40%" h="2rem" />
      <Bar w="55%" h="0.875rem" />
      <CardSkel lines={3} />
      <CardSkel lines={3} />
    </SkeletonPage>
  );
}
