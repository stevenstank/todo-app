type ErrorNoticeProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  disabled?: boolean;
  className?: string;
};

export default function ErrorNotice({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
  disabled = false,
  className = '',
}: ErrorNoticeProps) {
  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 ${className}`.trim()} role="alert">
      {title ? <p className="text-sm font-semibold text-red-700">{title}</p> : null}
      <p className="text-sm text-red-700">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
