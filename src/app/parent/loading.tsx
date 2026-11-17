import { Bar, CardSkel, SkeletonPage } from "@/lib/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      <SkeletonPage className="flex flex-col gap-5">
        <Bar w="8rem" h="2rem" />
        <Bar w="70%" h="2.5rem" />
        <div className="grid grid-cols-2 gap-3">
          <CardSkel lines={1} hero />
          <CardSkel lines={1} />
        </div>
        <CardSkel lines={4} />
        <CardSkel lines={3} />
      </SkeletonPage>
    </main>
  );
}
