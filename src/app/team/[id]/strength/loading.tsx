import { Bar, CardSkel, SkeletonPage, TabsSkel } from "@/lib/skeleton";

/** Strength tests, exercise library and workouts share a tab strip and a list of cards. */
export default function Loading() {
  return (
    <SkeletonPage>
      <TabsSkel n={3} />
      <Bar w="40%" h="0.75rem" />
      <CardSkel lines={3} />
      <CardSkel lines={3} />
    </SkeletonPage>
  );
}
