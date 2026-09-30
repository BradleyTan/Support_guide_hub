import { BlockSkeleton, ListSkeleton } from "@/components/shared/states";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <BlockSkeleton className="h-8 max-w-xs" />
      <BlockSkeleton className="h-4 max-w-md" />
      <ListSkeleton rows={5} />
    </div>
  );
}
