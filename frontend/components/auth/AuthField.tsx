import { InputHTMLAttributes } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
} & InputHTMLAttributes<HTMLInputElement>;

const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-200';

export default function AuthField({ id, label, className = '', ...props }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input id={id} className={`${inputClassName} ${className}`.trim()} {...props} />
    </div>
  );
}
