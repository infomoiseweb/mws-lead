
import React, { Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import LoginPage from './src/pages/LoginPage';
import AdminDashboard from './src/pages/admin/AdminDashboard';
import AdminOverview from './src/pages/admin/AdminOverview';
import ClientDashboard from './src/pages/client/ClientDashboard';
import ClientOverview from './src/pages/client/ClientOverview';
import ApiHandlerPage from './src/pages/admin/ApiHandlerPage';
import AnalyticsPage from './src/pages/AnalyticsPage';
import Layout from './src/components/layout/Layout';
import AccountSettingsPage from './src/pages/AccountSettingsPage';
import TermsPage from './src/pages/TermsPage';
import ChatPage from './src/pages/ChatPage';
import MwsRevenuePage from './src/pages/admin/MwsRevenuePage';
import SendNotificationPage from './src/pages/admin/SendNotificationPage';
import NotificationsPage from './src/pages/NotificationsPage';
import ManageNotificationsPage from './src/pages/admin/ManageNotificationsPage';
import { useTranslation } from 'react-i18next';
import CalendarPage from './src/pages/CalendarPage';
import QuotesPage from './src/pages/QuotesPage';
import { supabase } from './src/lib/supabase';

const ProtectedRoute: React.FC<{ children: React.ReactElement; role: 'admin' | 'client' }> = ({ children, role }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user.role !== role) {
        const defaultPath = user.role === 'admin' ? '/admin/overview' : `/client/${user.id}/overview`;
        return <Navigate to={defaultPath} replace />;
    }

    return children;
};

const AppLayout: React.FC<{ role: 'admin' | 'client' }> = ({ role }) => (
    <ProtectedRoute role={role}>
        <Layout>
            <Outlet />
        </Layout>
    </ProtectedRoute>
);

const AppRoutes: React.FC = () => {
    const { user, isLoading, logout } = useAuth();

    // Listener per il broadcast di force-logout
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('force-logout')
            .on('broadcast', { event: 'logout' }, (payload) => {
                if (payload.userId === user.id) {
                    console.log("Sospensione rilevata. Eseguo logout forzato.");
                    logout();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, logout]);

    if (isLoading) {
        return <div className="w-screen h-screen flex items-center justify-center">Caricamento / Loading...</div>;
    }

    // This component handles redirection for the root path '/'.
    const RootRedirector: React.FC = () => {
        if (user) {
            const dashboardPath = user.role === 'admin' ? '/admin/overview' : `/client/${user.id}/overview`;
            return <Navigate to={dashboardPath} replace />;
        }
        return <Navigate to="/login" replace />;
    };

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/api/lead/:clientId" element={<ApiHandlerPage />} />

            <Route path="/admin" element={<AppLayout role="admin" />}>
                <Route path="overview" element={<AdminOverview />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="revenue" element={<MwsRevenuePage />} />
                <Route path="settings" element={<AccountSettingsPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="send-notification" element={<SendNotificationPage />} />
                <Route path="manage-notifications" element={<ManageNotificationsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route index element={<Navigate to="overview" replace />} />
            </Route>

            <Route path="/client/:userId" element={<AppLayout role="client" />}>
                <Route path="overview" element={<ClientOverview />} />
                <Route path="dashboard" element={<ClientDashboard />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="quotes" element={<QuotesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="revenue" element={<MwsRevenuePage />} />
                <Route path="settings" element={<AccountSettingsPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route index element={<Navigate to="overview" replace />} />
            </Route>
            
            {/* Redirect from root path. This has lower precedence than specific routes. */}
            <Route path="/" element={<RootRedirector />} />
            
            {/* For any other un-matched path (404), redirect to the root. The root will then handle redirection to dashboard or login. */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const AppCore: React.FC = () => {
    const { i18n } = useTranslation();
    useEffect(() => {
        document.documentElement.lang = i18n.language;
        localStorage.setItem('language', i18n.language);
    }, [i18n.language]);

    return <AppRoutes />;
}

function App() {
    return (
        <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center">Caricamento / Loading...</div>}>
            <ThemeProvider>
                <AuthProvider>
                    <HashRouter>
                        <AppCore />
                    </HashRouter>
                </AuthProvider>
            </ThemeProvider>
        </Suspense>
    );
}

export default App;
