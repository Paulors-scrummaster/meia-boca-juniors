import { RouterProvider } from 'react-router-dom';

import { PwaUpdatePrompt } from '@/app/components/PwaUpdatePrompt';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { ErrorBoundary } from '@/app/providers/ErrorBoundary';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { appRouter } from '@/app/router/router';

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryProvider>
          <RouterProvider router={appRouter} />
          <PwaUpdatePrompt />
        </QueryProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
