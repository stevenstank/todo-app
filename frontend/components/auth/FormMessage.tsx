type FormMessageProps = {
  message?: string;
};

export default function FormMessage({ message }: FormMessageProps) {
  return (
    <div className="min-h-6" aria-live="polite">
      {message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
