import { RouterProvider } from '@tanstack/react-router';
import { Providers } from '@/app/Providers';
import { router } from '@/app/router';

export function App(): React.ReactElement {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

export default App;
