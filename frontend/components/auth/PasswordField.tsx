'use client';

import { InputHTMLAttributes, useState } from 'react';

type PasswordFieldProps = {
  id: string;
  label: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-11 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-700 focus:ring-2 focus:ring-slate-200';

const iconClassName = 'h-5 w-5';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12s-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 4.24A9.97 9.97 0 0 1 12 4.5c6 0 9.75 7.5 9.75 7.5a16.35 16.35 0 0 1-4.01 4.88" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.61 6.61A16.2 16.2 0 0 0 2.25 12s3.75 7.5 9.75 7.5a9.9 9.9 0 0 0 5.4-1.6" />
    </svg>
  );
}

export default function PasswordField({ id, label, className = '', ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input id={id} type={isVisible ? 'text' : 'password'} className={`${inputClassName} ${className}`.trim()} {...props} />
        <button
          type="button"
          onClick={() => setIsVisible((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
