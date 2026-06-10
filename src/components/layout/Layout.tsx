import React, { ReactNode, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
    children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'mws_sidebar_collapsed';

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    });

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
            <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-grow p-2 sm:p-4 md:p-6 lg:p-8">
                    <main>
                        {children}
                    </main>
                </div>
                <footer className="w-full text-center p-4 mt-auto border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950">
                    <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-center items-center gap-x-4 gap-y-1">
                        <a href="https://moise-web-srl.com/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-500 transition-colors">
                            {t('footer_developed_by')}
                        </a>
                        <span className="hidden sm:inline">|</span>
                        <span>{t('footer_hq')}</span>
                        <span className="hidden sm:inline">|</span>
                        <span>P.IVA: RO50469659</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Layout;
