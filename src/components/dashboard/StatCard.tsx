import React from 'react';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue?: string;
    gradient: string; // tailwind gradient classes, e.g. "from-cyan-500 to-blue-600"
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, gradient }) => {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${gradient}
                shadow-[0_10px_25px_-8px_rgba(0,0,0,0.5)] hover:shadow-[0_18px_35px_-10px_rgba(0,0,0,0.6)]
                transition-all duration-300 hover:-translate-y-1`}
        >
            {/* Decorative glow */}
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15 blur-2xl pointer-events-none" />
            <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-black/10 blur-xl pointer-events-none" />

            <div className="relative flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">{value}</p>
                    {subValue && <p className="mt-1 text-xs text-white/75">{subValue}</p>}
                </div>
                <div className="flex-shrink-0 p-2.5 rounded-xl bg-white/15 backdrop-blur-sm shadow-inner">
                    {icon}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
