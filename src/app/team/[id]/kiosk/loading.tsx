import { Bar, SkeletonPage } from "@/lib/skeleton";

/** iPad kiosk (pick, grid, runner): large calm tiles; the team navigation is hidden there anyway. */
export default function Loading() {
  return (
    <SkeletonPage>
      <Bar w="50%" h="2.5rem" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <Bar key={i} h="6rem" className="!rounded-3xl" />)}
      </div>
    </SkeletonPage>
  );
}
