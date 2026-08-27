import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from '@/app/providers/AuthProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { appRouter } from '@/app/router/router';

export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RouterProvider router={appRouter} />
      </AuthProvider>
    </QueryProvider>
  );
}
