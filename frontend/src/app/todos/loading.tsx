import SkeletonTodo from '@root/components/ui/SkeletonTodo';
import TopLoadingBar from '@root/components/ui/TopLoadingBar';

export default function TodosLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl py-8">
      <TopLoadingBar active={true} />
      <p className="mb-3 text-sm text-slate-500" role="status" aria-live="polite">
        Loading your todos...
      </p>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200" />
        </header>

        <div className="space-y-5 px-5 py-6">
          <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />

          <div className="flex flex-col gap-3 sm:flex-row" aria-hidden="true">
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-200" />
            <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-200" />
          </div>

          <SkeletonTodo count={4} />
        </div>
      </section>
    </main>
  );
}
