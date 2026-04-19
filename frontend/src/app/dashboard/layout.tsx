import { ReactNode } from 'react';
import ProtectedRoute from '@root/components/auth/ProtectedRoute';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
