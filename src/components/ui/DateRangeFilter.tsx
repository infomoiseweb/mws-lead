import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

type DateRange = {
    start: Date | null;
    end: Date | null;
};

type Preset = 'all' | 'today' | 'yesterday' | 'lastWeek' | 'thisMonth' | 'lastMonth';

interface DateRangeFilterProps {
    onDateChange: (range: DateRange) => void;
    defaultPreset?: Preset;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onDateChange, defaultPreset = 'today' }) => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activePreset, setActivePreset] = useState<string | null>(null);

    const toInputDateString = (date: Date | null): string => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const applyPreset = (preset: Preset, updateUrl = true) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start: Date | null = new Date(today);
        let end: Date | null = new Date(today);

        if (preset === 'all') {
            start = null;
            end = null;
        } else {
            end.setHours(23, 59, 59, 999);
            switch (preset) {
                case 'today':
                    break;
                case 'yesterday':
                    start.setDate(today.getDate() - 1);
                    end.setDate(today.getDate() - 1);
                    break;
                case 'lastWeek': {
                    const dayOfWeek = today.getDay();
                    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
                    start = new Date(new Date().setDate(diff));
                    start.setHours(0, 0, 0, 0);
                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);
                    break;
                }
                case 'thisMonth':
                    start = new Date(today.getFullYear(), today.getMonth(), 1);
                    end = new Date();
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'lastMonth':
                    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    end = new Date(today.getFullYear(), today.getMonth(), 0);
                    end.setHours(23, 59, 59, 999);
                    break;
            }
        }

        setStartDate(toInputDateString(start));
        setEndDate(toInputDateString(end));
        setActivePreset(preset);
        onDateChange({ start, end });

        if (updateUrl) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('filter', preset);
                next.delete('start');
                next.delete('end');
                return next;
            }, { replace: true });
        }
    };

    useEffect(() => {
        const urlFilter = searchParams.get('filter') as Preset | null;
        const urlStart = searchParams.get('start');
        const urlEnd = searchParams.get('end');

        if (urlFilter) {
            applyPreset(urlFilter, false);
        } else if (urlStart || urlEnd) {
            const startObj = urlStart ? new Date(`${urlStart}T00:00:00`) : null;
            const endObj = urlEnd ? new Date(`${urlEnd}T23:59:59`) : null;
            setStartDate(urlStart || '');
            setEndDate(urlEnd || '');
            setActivePreset(null);
            onDateChange({ start: startObj, end: endObj });
        } else {
            applyPreset(defaultPreset);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePresetClick = (preset: Preset) => {
        applyPreset(preset);
    };

    const handleDateChange = (type: 'start' | 'end', value: string) => {
        let newStartStr = startDate;
        let newEndStr = endDate;

        if (type === 'start') {
            setStartDate(value);
            newStartStr = value;
        } else {
            setEndDate(value);
            newEndStr = value;
        }

        setActivePreset(null);
        const startObj = newStartStr ? new Date(`${newStartStr}T00:00:00`) : null;
        const endObj = newEndStr ? new Date(`${newEndStr}T23:59:59`) : null;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('filter');
            if (newStartStr) next.set('start', newStartStr); else next.delete('start');
            if (newEndStr) next.set('end', newEndStr); else next.delete('end');
            return next;
        }, { replace: true });

        onDateChange({ start: startObj, end: endObj });
    };
    
    const presetButtonClasses = (preset: string) => 
        `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        activePreset === preset 
        ? 'bg-primary-600 text-white' 
        : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-gray-300'
        }`;

    return (
        <div className="flex items-center flex-wrap gap-2">
            <button onClick={() => handlePresetClick('all')} className={presetButtonClasses('all')}>{t('component_dateRangeFilter.all')}</button>
            <button onClick={() => handlePresetClick('today')} className={presetButtonClasses('today')}>{t('component_dateRangeFilter.today')}</button>
            <button onClick={() => handlePresetClick('yesterday')} className={presetButtonClasses('yesterday')}>{t('component_dateRangeFilter.yesterday')}</button>
            <button onClick={() => handlePresetClick('lastWeek')} className={presetButtonClasses('lastWeek')}>{t('component_dateRangeFilter.last_week')}</button>
            <button onClick={() => handlePresetClick('thisMonth')} className={presetButtonClasses('thisMonth')}>{t('component_dateRangeFilter.this_month')}</button>
            <button onClick={() => handlePresetClick('lastMonth')} className={presetButtonClasses('lastMonth')}>{t('component_dateRangeFilter.last_month')}</button>
            
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="relative">
                    <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => handleDateChange('start', e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 text-sm text-slate-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 w-36"
                    />
                </div>
                <span>{t('to')}</span>
                 <div className="relative">
                    <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => handleDateChange('end', e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-3 text-sm text-slate-800 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 w-36"
                    />
                </div>
            </div>
        </div>
    );
};

export default DateRangeFilter;