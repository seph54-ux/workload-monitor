import { Providers } from './app/Providers';
import { AppRoutes } from './app/routes';

export default function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}
