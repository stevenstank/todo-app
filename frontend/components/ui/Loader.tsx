'use client';

type LoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClassMap: Record<NonNullable<LoaderProps['size']>, string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-4.5 w-4.5 border-2',
  lg: 'h-6 w-6 border-[3px]',
};

export default function Loader({ size = 'md', className = '' }: LoaderProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${sizeClassMap[size]} ${className}`.trim()}
    />
  );
}
