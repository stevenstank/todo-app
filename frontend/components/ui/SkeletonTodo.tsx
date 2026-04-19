type SkeletonTodoProps = {
  count?: number;
};

export default function SkeletonTodo({ count = 4 }: SkeletonTodoProps) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`skeleton-${index}`}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
          </div>

          <div className="flex gap-2">
            <div className="h-7 w-24 animate-pulse rounded-md bg-slate-200" />
            <div className="h-7 w-16 animate-pulse rounded-md bg-slate-200" />
          </div>
        </article>
      ))}
    </div>
  );
}
