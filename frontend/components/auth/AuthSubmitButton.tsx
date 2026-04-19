import Loader from '@root/components/ui/Loader';

type AuthSubmitButtonProps = {
  label: string;
  loadingLabel: string;
  disabled?: boolean;
  isLoading?: boolean;
};

export default function AuthSubmitButton({
  label,
  loadingLabel,
  disabled = false,
  isLoading = false,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="relative h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      <span className={isLoading ? 'opacity-0' : 'opacity-100'}>{label}</span>
      {isLoading ? (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Loader size="sm" className="text-white" />
          <span>{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
}
