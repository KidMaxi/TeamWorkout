import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

/** Inside the team layout (header and nav stay): a dashboard-shaped placeholder for overview and any other team page. */
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col gap-3"><Bar w="50%" h="0.75rem" /><Bar w="40%" h="2rem" /></div>
        <div className="card flex flex-col gap-3"><Bar w="50%" h="0.75rem" /><Bar w="40%" h="2rem" /></div>
      </div>
      <CardSkel lines={3} hero />
      <CardSkel lines={2} />
      <CardSkel lines={2} />
    </SkeletonPage>
  );
}
