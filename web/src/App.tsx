import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/providers/theme-provider';

import RootLayout from './layout/RootLayout';
import CreateStatement from './pages/create-statement';
import Feed from './pages/feed';
import Landing from './pages/landing';
import Statement from './pages/statement';
import DashboardLayout from './layout/DashboardLayout';
import DashboardPage from './pages/dashboard';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Landing /> },
      {
        path: 'statement',
        children: [
          { path: 'feed', element: <Feed /> },
          { path: 'feed/:id', element: <Statement /> },
          { path: 'create', element: <CreateStatement /> },
        ],
      },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
