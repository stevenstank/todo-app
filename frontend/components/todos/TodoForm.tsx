type TodoFormProps = {
  value: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function TodoForm({ value, isSubmitting, onChange, onSubmit }: TodoFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="todo"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a new todo"
        disabled={isSubmitting}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-700 focus:ring-2 focus:ring-slate-200"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? 'Creating...' : 'Add Todo'}
      </button>
    </form>
  );
}
