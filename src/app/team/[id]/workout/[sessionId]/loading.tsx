import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Workout runner: title and the first exercise blocks. */
export default function Loading() {
  return (
    <SkeletonPage>
      <Bar w="55%" h="1.75rem" />
      <CardSkel lines={4} hero />
      <CardSkel lines={4} />
    </SkeletonPage>
  );
}
