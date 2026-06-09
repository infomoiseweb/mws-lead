import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ApiService } from '../services/apiService';
import type { Client, MwsMonthlyRevenue } from '../types';
import { DollarSign, RefreshCw, Save, CheckCircle, AlertCircle, TrendingUp, CreditCard, ListChecks, Calculator } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { useTranslation } from 'react-i18next';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg flex items-center border border-slate-200 dark:border-slate-700">
        <div className="bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 p-3 rounded-full mr-4">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (paymentDetails: { amount: number; isTotal: boolean }) => void;
    clientName: string;
    month: string;
    totalDue: number;
    existingPaidAmount: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSave, clientName, month, totalDue, existingPaidAmount }) => {
    const { t } = useTranslation();
    const remainingDue = Math.max(0, totalDue - existingPaidAmount);
    const [isPaidInFull, setIsPaidInFull] = useState(remainingDue === 0);
    const [amount, setAmount] = useState<string>('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const newRemainingDue = Math.max(0, totalDue - existingPaidAmount);
            setIsPaidInFull(newRemainingDue === 0);
            setAmount(newRemainingDue > 0 ? newRemainingDue.toFixed(2) : '');
            setError('');
        }
    }, [isOpen, totalDue, existingPaidAmount]);

    const handleSave = () => {
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount < 0) {
            setError(t('page_mwsRevenue.payment_modal.error_invalid_amount'));
            return;
        }
        if (!isPaidInFull && paymentAmount > remainingDue) {
            setError(t('page_mwsRevenue.payment_modal.error_overpayment'));
            return;
        }

        const totalPaidAmount = (existingPaidAmount || 0) + (isPaidInFull ? remainingDue : paymentAmount);

        onSave({
            amount: totalPaidAmount,
            isTotal: isPaidInFull || totalPaidAmount >= totalDue,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('page_mwsRevenue.payment_modal.title')}>
            <div className="space-y-4">
                <p>{t('page_mwsRevenue.payment_modal.description', { clientName, month })}</p>
                <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-gray-400">{t('page_mwsRevenue.payment_modal.total_due')}</span> <span className="font-semibold">{totalDue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500 dark:text-gray-400">{t('page_mwsRevenue.payment_modal.already_paid')}</span> <span className="font-semibold">{existingPaidAmount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-300 dark:border-slate-600"><span className="text-slate-800 dark:text-white">{t('page_mwsRevenue.payment_modal.remaining')}</span> <span>{remainingDue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></div>
                </div>
                <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border border-slate-200 dark:border-slate-600">
                        <input
                            type="checkbox"
                            checked={isPaidInFull}
                            onChange={(e) => setIsPaidInFull(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{t('page_mwsRevenue.payment_modal.pay_in_full')}</span>
                    </label>
                    <div>
                        <label htmlFor="paymentAmount" className="block text-sm font-medium text-slate-700 dark:text-gray-300">{t('page_mwsRevenue.payment_modal.payment_amount')}</label>
                        <input
                            id="paymentAmount"
                            type="number"
                            value={isPaidInFull ? remainingDue.toFixed(2) : amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={isPaidInFull}
                            placeholder="0.00"
                            step="0.01"
                            className="mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">{t('cancel')}</button>
                    <button type="button" onClick={handleSave} className="bg-primary-600 text-white px-4 py-2 rounded-lg shadow hover:bg-primary-700">{t('page_mwsRevenue.payment_modal.confirm_and_save')}</button>
                </div>
            </div>
        </Modal>
    );
};

interface ClientRevenueCalculatorProps {
    client: Client;
    dateRange: { start: Date | null; end: Date | null };
    savedDataForMonth: MwsMonthlyRevenue | undefined;
    onClientUpdate: () => void;
    isReadOnly: boolean;
    onOpenPaymentModal: (totalDue: number) => void;
}

const ClientRevenueCalculator: React.FC<ClientRevenueCalculatorProps> = ({ client, dateRange, savedDataForMonth, onClientUpdate, isReadOnly, onOpenPaymentModal }) => {
    const { t } = useTranslation();
    const [fee, setFee] = useState(String(client.mws_fixed_fee || ''));
    const [percentage, setPercentage] = useState(String(client.mws_profit_percentage || ''));
    
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isDirty, setIsDirty] = useState(false);
    const settingsSaveTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        setFee(String(client.mws_fixed_fee || ''));
        setPercentage(String(client.mws_profit_percentage || ''));
        setIsDirty(false);
    }, [client]);

    useEffect(() => {
        return () => {
            if (settingsSaveTimeoutRef.current) {
                clearTimeout(settingsSaveTimeoutRef.current);
            }
        };
    }, []);

    const handleSettingsChange = (type: 'fee' | 'percentage', value: string) => {
        if (isReadOnly) return;

        if (type === 'fee') setFee(value);
        else setPercentage(value);
        
        setIsDirty(true);
        setSettingsSaveStatus('idle');
        if (settingsSaveTimeoutRef.current) clearTimeout(settingsSaveTimeoutRef.current);

        settingsSaveTimeoutRef.current = window.setTimeout(() => {
            handleSaveSettings(type, value);
        }, 1500);
    };

    const handleSaveSettings = async (type: 'fee' | 'percentage', value: string) => {
        if (isReadOnly) return;
        setIsSavingSettings(true);
        
        const currentFee = type === 'fee' ? value : fee;
        const currentPercentage = type === 'percentage' ? value : percentage;
        
        try {
            await ApiService.updateClient(client.id, {
                mws_fixed_fee: parseFloat(currentFee) || 0,
                mws_profit_percentage: parseFloat(currentPercentage) || 0,
            });
            setSettingsSaveStatus('success');
            setIsDirty(false);
            onClientUpdate();
        } catch (error) {
            setSettingsSaveStatus('error');
            console.error("Failed to save client revenue settings:", error);
        } finally {
            setIsSavingSettings(false);
            setTimeout(() => setSettingsSaveStatus('idle'), 3000);
        }
    };
    
    const filteredData = useMemo(() => {
        const { leads = [], adSpends = [] } = client;
        const filterStart = dateRange.start;
        const filterEnd = dateRange.end;

        if (!filterStart && !filterEnd) {
            return { filteredLeads: leads, filteredSpends: adSpends };
        }

        const filteredLeads = leads.filter(l => {
            const leadDate = new Date(l.data._revenue_attribution_date || l.created_at);
            const isAfterStart = filterStart ? leadDate >= filterStart : true;
            const isBeforeEnd = filterEnd ? leadDate <= filterEnd : true;
            return isAfterStart && isBeforeEnd;
        });
        
        const filteredSpends = adSpends.filter(s => {
            // FIX: Use a valid date string format for the Date constructor to avoid timezone issues.
            const spendDate = new Date(s.date + 'T00:00:00');
            const isAfterStart = filterStart ? spendDate >= filterStart : true;
            const isBeforeEnd = filterEnd ? spendDate <= filterEnd : true;
            return isAfterStart && isBeforeEnd;
        });

        return { filteredLeads, filteredSpends };
    }, [client, dateRange]);

    const calculations = useMemo(() => {
        const clientRevenue = filteredData.filteredLeads
            .filter(l => l.status === 'Vinto')
            .reduce((sum, l) => sum + (l.value || 0), 0);
        
        const clientSpend = filteredData.filteredSpends.reduce((sum, s) => sum + s.amount, 0);
        
        const clientProfit = clientRevenue - clientSpend;

        const mwsFixedFee = parseFloat(fee) || 0;
        const mwsProfitPercentage = parseFloat(percentage) || 0;
        const mwsProfitShare = (Math.max(0, clientProfit) * mwsProfitPercentage) / 100;
        const mwsRevenue = mwsFixedFee + mwsProfitShare;

        return { clientRevenue, clientSpend, clientProfit, mwsRevenue };
    }, [filteredData, fee, percentage]);
    
    const formatCurrency = (value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    const profitColor = calculations.clientProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';

    const renderSettingsStatusIndicator = () => {
        if (isSavingSettings) return <span title="Salvataggio..."><RefreshCw size={16} className="animate-spin text-gray-500" /></span>;
        switch (settingsSaveStatus) {
            case 'success': return <span title="Salvato"><CheckCircle size={16} className="text-green-500" /></span>;
            case 'error': return <span title="Errore nel salvataggio"><AlertCircle size={16} className="text-red-500" /></span>;
            default:
                if (isDirty) {
                    return <span title="Modifiche in attesa di salvataggio"><Save size={16} className="text-gray-400" /></span>;
                }
                return <div className="w-4 h-4" />;
        }
    };
    
    const renderPaymentStatus = () => {
        if (!dateRange.start) {
            return <span className="text-xs text-slate-500">Seleziona un mese</span>;
        }
        const status = savedDataForMonth?.status || 'unpaid';
        const paid = savedDataForMonth?.paid_amount || 0;

        switch (status) {
            case 'paid':
                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-300">Pagato</span>;
            case 'partially_paid':
                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-300">Parziale ({formatCurrency(paid)})</span>;
            case 'unpaid':
            default:
                 return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-800 bg-red-100 rounded-full dark:bg-red-900 dark:text-red-300">Non Pagato</span>;
        }
    };
    
    return (
        <>
        {/* Desktop Row */}
        <tr className="hidden md:table-row hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{client.name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-300">{formatCurrency(calculations.clientRevenue)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-300">{formatCurrency(calculations.clientSpend)}</td>
            <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${profitColor}`}>{formatCurrency(calculations.clientProfit)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                 <div className="flex items-center gap-2">
                    <input type="number" value={fee} onChange={e => handleSettingsChange('fee', e.target.value)} readOnly={isReadOnly} className={`w-24 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0"/>
                    {!isReadOnly && <div className="w-4 h-4">{renderSettingsStatusIndicator()}</div>}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                <input type="number" value={percentage} onChange={e => handleSettingsChange('percentage', e.target.value)} readOnly={isReadOnly} className={`w-20 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0"/>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-600 dark:text-primary-400">{formatCurrency(calculations.mwsRevenue)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">{renderPaymentStatus()}</td>
            {!isReadOnly && (
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button onClick={() => onOpenPaymentModal(calculations.mwsRevenue)} disabled={!dateRange.start} className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-xs shadow hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <CreditCard size={14}/>
                        Gestisci
                    </button>
                </td>
            )}
        </tr>
        {/* Mobile Card */}
        <div className="md:hidden p-4 rounded-lg shadow border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 space-y-3">
            <h4 className="font-bold text-lg text-slate-900 dark:text-white">{client.name}</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-gray-400">Fatturato Cliente:</div><div className="font-medium text-right text-slate-700 dark:text-gray-200">{formatCurrency(calculations.clientRevenue)}</div>
                <div className="text-slate-500 dark:text-gray-400">Spesa Pubblicitaria:</div><div className="font-medium text-right text-slate-700 dark:text-gray-200">{formatCurrency(calculations.clientSpend)}</div>
                <div className="text-slate-500 dark:text-gray-400">Profitto Cliente:</div><div className={`font-semibold text-right ${profitColor}`}>{formatCurrency(calculations.clientProfit)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">Compenso Fisso (€)</label>
                    <div className="flex items-center gap-2">
                        <input type="number" value={fee} onChange={e => handleSettingsChange('fee', e.target.value)} readOnly={isReadOnly} className={`w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0"/>
                        {!isReadOnly && <div className="w-4 h-4 flex-shrink-0">{renderSettingsStatusIndicator()}</div>}
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-gray-400 mb-1">{t('page_mwsRevenue.mws_profit_perc')}</label>
                    <input type="number" value={percentage} onChange={e => handleSettingsChange('percentage', e.target.value)} readOnly={isReadOnly} className={`w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1 px-2 text-sm ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0"/>
                </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="font-bold text-primary-600 dark:text-primary-400 mb-3">Fatturato MWS: {formatCurrency(calculations.mwsRevenue)}</div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-500 dark:text-gray-400">{t('page_mwsRevenue.payment_status')}:</span>
                        {renderPaymentStatus()}
                    </div>
                    {!isReadOnly && (
                        <div className="flex items-center gap-2">
                           <button onClick={() => onOpenPaymentModal(calculations.mwsRevenue)} disabled={isSavingSettings || !dateRange.start} className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-xs shadow hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                                <CreditCard size={14}/>
                                Gestisci
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
};


const MwsRevenuePage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [clients, setClients] = useState<Client[]>([]);
    const [monthlyRevenues, setMonthlyRevenues] = useState<MwsMonthlyRevenue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [paymentModalState, setPaymentModalState] = useState<{
        isOpen: boolean;
        client?: Client;
        totalDue?: number;
        existingData?: MwsMonthlyRevenue;
    }>({ isOpen: false });

    const isClientView = user?.role === 'client';

    const fetchData = useCallback(async () => {
        if (!isRefreshing) setIsLoading(true);
        try {
            let clientsData: Client[] = [];
            let revenueData: MwsMonthlyRevenue[] = [];

            if (user?.role === 'admin') {
                clientsData = await ApiService.getClients();
                revenueData = await ApiService.getMwsMonthlyRevenues();
            } else if (user?.role === 'client' && user.id) {
                const clientData = await ApiService.getClientByUserId(user.id);
                if (clientData) {
                    clientsData = [clientData];
                    revenueData = await ApiService.getMwsMonthlyRevenues(clientData.id);
                }
            }
            setClients(clientsData);
            setMonthlyRevenues(revenueData);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            setClients([]);
        } finally {
            if (!isRefreshing) setIsLoading(false);
        }
    }, [isRefreshing, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // Set default to last month
        const today = new Date();
        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const year = lastMonthDate.getFullYear();
        const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
        
        const initialMonthString = `${year}-${month}`;
        setSelectedMonth(initialMonthString);

        const start = new Date(year, lastMonthDate.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(year, lastMonthDate.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        
        setDateRange({ start, end });
    }, []); // Run only once on mount

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const monthString = e.target.value;
        setSelectedMonth(monthString);

        if (monthString) {
            const [year, month] = monthString.split('-').map(Number);
            const start = new Date(year, month - 1, 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(year, month, 0);
            end.setHours(23, 59, 59, 999);
            setDateRange({ start, end });
        } else {
            setDateRange({ start: null, end: null });
        }
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchData();
        setIsRefreshing(false);
    }, [fetchData]);

    const handleOpenPaymentModal = (client: Client, totalDue: number, existingData?: MwsMonthlyRevenue) => {
        setPaymentModalState({
            isOpen: true,
            client,
            totalDue,
            existingData,
        });
    };

    const handleSavePayment = async (paymentDetails: { amount: number; isTotal: boolean }) => {
        const { client, totalDue } = paymentModalState;
        if (!client || totalDue === undefined || !dateRange.start) return;

        const newPaidAmount = paymentDetails.amount;
        let newStatus: MwsMonthlyRevenue['status'];
        
        if (paymentDetails.isTotal) {
            newStatus = 'paid';
        } else if (newPaidAmount > 0) {
            newStatus = 'partially_paid';
        } else {
            newStatus = 'unpaid';
        }

        const monthDate = new Date(dateRange.start);
        const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;

        try {
            await ApiService.upsertMwsRevenue({
                client_id: client.id,
                month,
                revenue_amount: totalDue,
                paid_amount: newPaidAmount,
                status: newStatus,
            });
            setPaymentModalState({ isOpen: false });
            fetchData();
        } catch (error) {
            console.error("Failed to save payment", error);
        }
    };
    
    const revenuesForHistory = useMemo(() => {
        const filterStart = dateRange.start;
        const filterEnd = dateRange.end;

        return monthlyRevenues
            .filter(r => r.paid_amount > 0)
            .filter(r => {
                if (!filterStart && !filterEnd) return true;
                const revenueDate = new Date(r.month);
                const isAfterStart = filterStart ? revenueDate >= new Date(filterStart.getFullYear(), filterStart.getMonth(), 1) : true;
                const isBeforeEnd = filterEnd ? revenueDate <= new Date(filterEnd.getFullYear(), filterEnd.getMonth() + 1, 0) : true;
                return isAfterStart && isBeforeEnd;
            })
            .sort((a,b) => new Date(b.month).getTime() - new Date(a.month).getTime());

    }, [monthlyRevenues, dateRange]);


    const totalMwsRevenue = useMemo(() => {
        return clients.reduce((total, client) => {
            const { leads = [], adSpends = [] } = client;
            const filterStart = dateRange.start;
            const filterEnd = dateRange.end;
    
            const clientLeads = (!filterStart && !filterEnd) ? leads : leads.filter(l => {
                const leadDate = new Date(l.data._revenue_attribution_date || l.created_at);
                const isAfterStart = filterStart ? leadDate >= filterStart : true;
                const isBeforeEnd = filterEnd ? leadDate <= filterEnd : true;
                return isAfterStart && isBeforeEnd;
            });
            
            const clientSpends = (!filterStart && !filterEnd) ? adSpends : (adSpends || []).filter(s => {
                const spendDate = new Date(s.date + 'T00:00:00');
                const isAfterStart = filterStart ? spendDate >= filterStart : true;
                const isBeforeEnd = filterEnd ? spendDate <= filterEnd : true;
                return isAfterStart && isBeforeEnd;
            });
            
            const clientRevenue = clientLeads
                .filter(l => l.status === 'Vinto')
                .reduce((sum, l) => sum + (l.value || 0), 0);
            
            const totalClientSpend = clientSpends.reduce((sum, s) => sum + s.amount, 0);
            const clientProfit = clientRevenue - totalClientSpend;
    
            const mwsFixedFee = client.mws_fixed_fee || 0;
            const mwsProfitPercentage = client.mws_profit_percentage || 0;
            const mwsProfitShare = (Math.max(0, clientProfit) * mwsProfitPercentage) / 100;
            
            return total + mwsFixedFee + mwsProfitShare;
        }, 0);
    }, [clients, dateRange]);
    
    const monthString = useMemo(() => {
        if (!dateRange.start) return null;
        const monthDate = new Date(dateRange.start);
        return `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
    }, [dateRange.start]);
    
    const clientsToCalculate = useMemo(() => {
        return clients;
    }, [clients]);


    if (isLoading) {
        return <div className="text-center p-8">{t('loading')}</div>;
    }
    
    const formatCurrency = (value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center space-x-3">
                    <DollarSign className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('page_mwsRevenue.title')}</h2>
                </div>
                 <button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-wait transition-colors rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Aggiorna dati"
                >
                    <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </div>
            
             <StatCard 
                title={t('page_mwsRevenue.total_mws_revenue_period')} 
                value={totalMwsRevenue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                icon={<TrendingUp />}
            />

            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <label htmlFor="month-filter" className="text-sm font-medium text-slate-700 dark:text-gray-300">{t('page_mwsRevenue.filter_by_month')}</label>
                    <input
                        type="month"
                        id="month-filter"
                        value={selectedMonth}
                        onChange={handleMonthChange}
                        className="bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 text-sm text-slate-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center space-x-3">
                    <Calculator className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('page_mwsRevenue.calculator_title')}</h2>
                </div>
                <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {clientsToCalculate.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm hidden md:table">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.client')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.client_revenue')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.spend')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.client_profit')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.mws_fixed_fee')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.mws_profit_perc')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.mws_revenue')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_status')}</th>
                                        {!isClientView && (
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_actions')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {clientsToCalculate.map(client => {
                                        const savedDataForMonth = monthString ? monthlyRevenues.find(r => r.client_id === client.id && r.month === monthString) : undefined;
                                        return (
                                            <ClientRevenueCalculator
                                                key={client.id}
                                                client={client}
                                                dateRange={dateRange}
                                                savedDataForMonth={savedDataForMonth}
                                                onClientUpdate={fetchData}
                                                isReadOnly={isClientView}
                                                onOpenPaymentModal={(totalDue) => handleOpenPaymentModal(client, totalDue, savedDataForMonth)}
                                            />
                                        )
                                    })}
                                </tbody>
                            </table>
                            <div className="md:hidden p-2 space-y-3">
                                {clientsToCalculate.map(client => {
                                    const savedDataForMonth = monthString ? monthlyRevenues.find(r => r.client_id === client.id && r.month === monthString) : undefined;
                                    return (
                                        <ClientRevenueCalculator
                                            key={client.id}
                                            client={client}
                                            dateRange={dateRange}
                                            savedDataForMonth={savedDataForMonth}
                                            onClientUpdate={fetchData}
                                            isReadOnly={isClientView}
                                            onOpenPaymentModal={(totalDue) => handleOpenPaymentModal(client, totalDue, savedDataForMonth)}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                            {t('page_mwsRevenue.no_unpaid_invoices')}
                        </div>
                    )}
                </div>
            </div>

            {!isClientView && revenuesForHistory.length > 0 && (
                 <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                        <ListChecks className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{t('page_mwsRevenue.payment_history_title')}</h2>
                    </div>
                     <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                 <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.client')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.month')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.total_amount')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.paid_amount')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.remaining_amount')}</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('page_mwsRevenue.payment_history.status')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {revenuesForHistory.map(rev => {
                                        const clientName = clients.find(c => c.id === rev.client_id)?.name || 'N/D';
                                        const remaining = rev.revenue_amount - rev.paid_amount;
                                        return (
                                            <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{clientName}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-gray-300">{new Date(rev.month).toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-gray-300">{formatCurrency(rev.revenue_amount)}</td>
                                                <td className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">{formatCurrency(rev.paid_amount)}</td>
                                                <td className="px-6 py-4 font-semibold text-red-600 dark:text-red-400">{formatCurrency(remaining > 0 ? remaining : 0)}</td>
                                                <td className="px-6 py-4">
                                                    {rev.status === 'paid' && <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full dark:bg-green-900 dark:text-green-300">{t('page_mwsRevenue.payment_history.paid')}</span>}
                                                    {rev.status === 'partially_paid' && <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-300">{t('page_mwsRevenue.payment_history.partially_paid')}</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                 </div>
            )}
            
            {paymentModalState.isOpen && paymentModalState.client && dateRange.start && (
                <PaymentModal
                    isOpen={paymentModalState.isOpen}
                    onClose={() => setPaymentModalState({ isOpen: false })}
                    onSave={handleSavePayment}
                    clientName={paymentModalState.client.name}
                    month={new Date(dateRange.start).toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                    totalDue={paymentModalState.totalDue || 0}
                    existingPaidAmount={paymentModalState.existingData?.paid_amount || 0}
                />
            )}
        </div>
    );
};

export default MwsRevenuePage;