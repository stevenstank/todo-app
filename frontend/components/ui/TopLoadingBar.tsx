'use client';

type TopLoadingBarProps = {
  active: boolean;
};

export default function TopLoadingBar({ active }: TopLoadingBarProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 transition-opacity duration-200 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full w-2/5 animate-[loading-bar_1s_ease-in-out_infinite] bg-slate-900" />
    </div>
  );
}
