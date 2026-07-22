import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getClientMailMarketingFlag, getClientInstallmentsFlag, getClientMetaFlag } from '@api/clients';
import {
    LogOut, User as UserIcon, LayoutGrid, List, Users, BarChart3, DollarSign,
    FileCode, Activity, Calendar, FileText, ChevronsLeft, ChevronsRight, Plug, Send, Layers, Share2
} from 'lucide-react';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
}

interface NavItem {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive: (pathname: string, search: string) => boolean;
    end?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onNavigate }) => {
    const { user, logout } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    const isAdmin = user?.role === 'admin';
    const userId = user?.id || params.userId;

    const [mailMarketingEnabled, setMailMarketingEnabled] = useState(false);
    const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
    const [metaEnabled, setMetaEnabled] = useState(false);

    useEffect(() => {
        if (isAdmin || !userId) return;
        getClientMailMarketingFlag(userId).then(setMailMarketingEnabled).catch(() => setMailMarketingEnabled(false));
        getClientInstallmentsFlag(userId).then(setInstallmentsEnabled).catch(() => setInstallmentsEnabled(false));
        getClientMetaFlag(userId).then(setMetaEnabled).catch(() => setMetaEnabled(false));
    }, [isAdmin, userId]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const adminItems: NavItem[] = [
        {
            to: '/admin/overview',
            icon: <LayoutGrid size={20} />,
            label: t('nav_overview'),
            isActive: (pathname) => pathname === '/admin/overview',
        },
        {
            to: '/admin/dashboard',
            icon: <List size={20} />,
            label: t('nav_lead_management'),
            isActive: (pathname, search) => pathname === '/admin/dashboard' && (search === '' || search.includes('view=leads')),
        },
        {
            to: '/admin/calendar',
            icon: <Calendar size={20} />,
            label: t('nav_calendar'),
            isActive: (pathname) => pathname === '/admin/calendar',
        },
        {
            to: '/admin/quotes',
            icon: <FileText size={20} />,
            label: t('nav_quotes'),
            isActive: (pathname) => pathname === '/admin/quotes',
        },
        {
            to: '/admin/dashboard?view=live',
            icon: <Activity size={20} />,
            label: t('nav_live_overview'),
            isActive: (pathname, search) => pathname === '/admin/dashboard' && search.includes('view=live'),
        },
        {
            to: '/admin/dashboard?view=clients',
            icon: <Users size={20} />,
            label: t('nav_client_management'),
            isActive: (pathname, search) => pathname === '/admin/dashboard' && search.includes('view=clients'),
        },
        {
            to: '/admin/dashboard?view=forms',
            icon: <FileCode size={20} />,
            label: t('nav_form_generator'),
            isActive: (pathname, search) => pathname === '/admin/dashboard' && search.includes('view=forms'),
        },
        {
            to: '/admin/dashboard?view=spese',
            icon: <DollarSign size={20} />,
            label: t('nav_expense_management'),
            isActive: (pathname, search) => pathname === '/admin/dashboard' && search.includes('view=spese'),
        },
        {
            to: '/admin/analytics',
            icon: <BarChart3 size={20} />,
            label: t('nav_analysis'),
            isActive: (pathname) => pathname === '/admin/analytics',
        },
        {
            to: '/admin/revenue',
            icon: <DollarSign size={20} />,
            label: t('nav_mws_revenue'),
            isActive: (pathname) => pathname === '/admin/revenue',
        },
        {
            to: '/admin/mail-marketing',
            icon: <Send size={20} />,
            label: t('nav_mail_marketing'),
            isActive: (pathname) => pathname === '/admin/mail-marketing',
        },
    ];

    const clientItems: NavItem[] = [
        {
            to: `/client/${userId}/overview`,
            icon: <LayoutGrid size={20} />,
            label: t('nav_overview'),
            isActive: (pathname) => pathname === `/client/${userId}/overview`,
        },
        {
            to: `/client/${userId}/dashboard`,
            icon: <List size={20} />,
            label: t('nav_my_leads'),
            isActive: (pathname, search) => pathname === `/client/${userId}/dashboard` && !search.includes('view=live') && !search.includes('view=spese') && !search.includes('view=integrazioni'),
        },
        {
            to: `/client/${userId}/calendar`,
            icon: <Calendar size={20} />,
            label: t('nav_calendar'),
            isActive: (pathname) => pathname === `/client/${userId}/calendar`,
        },
        {
            to: `/client/${userId}/quotes`,
            icon: <FileText size={20} />,
            label: t('nav_quotes'),
            isActive: (pathname) => pathname === `/client/${userId}/quotes`,
        },
        {
            to: `/client/${userId}/dashboard?view=live`,
            icon: <Activity size={20} />,
            label: t('nav_live_overview'),
            isActive: (pathname, search) => pathname === `/client/${userId}/dashboard` && search.includes('view=live'),
        },
        {
            to: `/client/${userId}/dashboard?view=spese`,
            icon: <DollarSign size={20} />,
            label: t('nav_ad_expenses'),
            isActive: (pathname, search) => pathname === `/client/${userId}/dashboard` && search.includes('view=spese'),
        },
        {
            to: `/client/${userId}/dashboard?view=integrazioni`,
            icon: <Plug size={20} />,
            label: t('nav_integrations'),
            isActive: (pathname, search) => pathname === `/client/${userId}/dashboard` && search.includes('view=integrazioni'),
        },
        ...(mailMarketingEnabled ? [{
            to: `/client/${userId}/mail-marketing`,
            icon: <Send size={20} />,
            label: t('nav_mail_marketing'),
            isActive: (pathname: string) => pathname === `/client/${userId}/mail-marketing`,
        }] : []),
        ...(installmentsEnabled ? [{
            to: `/client/${userId}/installments`,
            icon: <Layers size={20} />,
            label: 'Rate',
            isActive: (pathname: string) => pathname === `/client/${userId}/installments`,
        }] : []),
        ...(metaEnabled ? [{
            to: `/client/${userId}/social`,
            icon: <Share2 size={20} />,
            label: 'Social',
            isActive: (pathname: string) => pathname === `/client/${userId}/social`,
        }] : []),
        {
            to: `/client/${userId}/analytics`,
            icon: <BarChart3 size={20} />,
            label: t('nav_data_analysis'),
            isActive: (pathname) => pathname === `/client/${userId}/analytics`,
        },
        {
            to: `/client/${userId}/revenue`,
            icon: <DollarSign size={20} />,
            label: t('nav_mws_revenue'),
            isActive: (pathname) => pathname === `/client/${userId}/revenue`,
        },
    ];

    const items = isAdmin ? adminItems : clientItems;

    const baseLinkClasses = "flex items-center rounded-lg text-sm font-medium transition-colors duration-150 text-slate-300 hover:bg-slate-800 hover:text-white";
    const activeLinkClasses = "bg-primary-600 text-white shadow-sm hover:bg-primary-600";

    return (
        <aside className={`${collapsed ? 'w-[68px]' : 'w-64'} flex-shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0 transition-all duration-200 z-40`}>
            {/* Logo */}
            <div className={`h-16 flex items-center border-b border-slate-800 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
                <img
                    src="https://moise-web-srl.com/wp-content/uploads/2025/07/web-app-manifest-512x512-2.png"
                    alt="MWS Gestione Lead Logo"
                    className="h-10 w-10 flex-shrink-0 rounded-md"
                />
                {!collapsed && (
                    <div className="ml-3 overflow-hidden">
                        <h1 className="text-sm font-semibold text-white leading-tight whitespace-nowrap">{t('header_title')}</h1>
                        <p className="text-xs text-slate-400 whitespace-nowrap">{t('header_version')}</p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
                {items.map((item) => {
                    const active = item.isActive(location.pathname, location.search);
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            className={`${baseLinkClasses} ${active ? activeLinkClasses : ''} ${collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}`}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <button
                onClick={onToggle}
                className="flex items-center justify-center mx-2 mb-2 p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title={collapsed ? t('sidebar_expand') : t('sidebar_collapse')}
            >
                {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>

            {/* User info + logout */}
            <div className={`border-t border-slate-800 p-3 ${collapsed ? 'flex flex-col items-center' : ''}`}>
                <div className={`flex items-center ${collapsed ? '' : 'mb-3'}`}>
                    <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-5 h-5 text-white" />
                    </div>
                    {!collapsed && (
                        <div className="ml-2.5 overflow-hidden">
                            <p className="text-sm font-semibold truncate">{user?.username}</p>
                            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    title={t('menu_logout')}
                    className={`flex items-center justify-center text-sm font-medium rounded-md text-red-100 bg-red-600/90 hover:bg-red-600 transition-colors ${collapsed ? 'w-9 h-9 mt-2' : 'w-full px-3 py-2 mt-0'}`}
                >
                    <LogOut className="w-4 h-4" />
                    {!collapsed && <span className="ml-2">{t('menu_logout')}</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
