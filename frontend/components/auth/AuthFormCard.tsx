import { ReactNode } from 'react';

type AuthFormCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthFormCard({ title, description, children, footer }: AuthFormCardProps) {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm leading-relaxed text-slate-500">{description}</p>
        </div>

        {children}

        <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
      </section>
    </main>
  );
}
