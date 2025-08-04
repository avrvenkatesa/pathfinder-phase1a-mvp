import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import theme from './styles/theme';
import { AuthProvider } from './context/AuthContext';
import { ContactProvider } from './context/ContactContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import ContactsPage from './pages/contacts/ContactsPage';
import ContactDetailsPage from './pages/contacts/ContactDetailsPage';
import CreateContactPage from './pages/contacts/CreateContactPage';
import EditContactPage from './pages/contacts/EditContactPage';
import DashboardPage from './pages/dashboard/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ContactProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/contacts" element={<ContactsPage />} />
                          <Route path="/contacts/:id" element={<ContactDetailsPage />} />
                          <Route path="/contacts/new" element={<CreateContactPage />} />
                          <Route path="/contacts/:id/edit" element={<EditContactPage />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Router>
            <Toaster position="top-right" />
          </ContactProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
