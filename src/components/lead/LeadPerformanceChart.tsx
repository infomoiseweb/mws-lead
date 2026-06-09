import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Lead } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface LeadPerformanceChartProps {
  leads: Lead[];
}

const LeadPerformanceChart: React.FC<LeadPerformanceChartProps> = ({ leads }) => {
  const monthlyData = useMemo(() => {
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const currentYear = new Date().getFullYear();
    
    const leadsByMonth = new Array(12).fill(0);
    const conversionsByMonth = new Array(12).fill(0);

    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      if (date.getFullYear() === currentYear) {
        const monthIndex = date.getMonth();
        leadsByMonth[monthIndex]++;
        if (lead.status === 'Vinto') {
          conversionsByMonth[monthIndex]++;
        }
      }
    });

    const totalLeads = leadsByMonth.reduce((a, b) => a + b, 0);
    const totalConversions = conversionsByMonth.reduce((a, b) => a + b, 0);
    const avgCR = totalLeads > 0 ? (totalConversions / totalLeads * 100).toFixed(1) : "0.0";

    return {
      labels: months,
      leadsData: leadsByMonth,
      conversionsData: conversionsByMonth,
      totalLeads,
      totalConversions,
      avgCR
    };
  }, [leads]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#9aa4ad",
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: "#0d0d0d",
        titleColor: "#00e5ff",
        bodyColor: "#ffffff",
        borderColor: "#00bfff",
        borderWidth: 1,
        padding: 14
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { color: "#9aa4ad" }
      },
      y: {
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#9aa4ad" }
      }
    }
  };

  const data = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: "Lead acquisiti",
        data: monthlyData.leadsData,
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(0,229,255,0.35)");
          gradient.addColorStop(1, "rgba(0,229,255,0.02)");
          return gradient;
        },
        borderColor: "#00e5ff",
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: "#00e5ff",
        pointBorderWidth: 0
      },
      {
        label: "Lead convertiti",
        data: monthlyData.conversionsData,
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(0,191,255,0.35)");
          gradient.addColorStop(1, "rgba(0,191,255,0.02)");
          return gradient;
        },
        borderColor: "#00bfff",
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#00bfff",
        pointBorderWidth: 2
      }
    ]
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#0f0f0f] to-[#090909] rounded-[18px] p-6 md:p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_25px_60px_rgba(0,0,0,0.8)] mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="text-[22px] font-semibold tracking-[0.3px] text-white">Lead Performance</div>
          <div className="text-sm text-[#9aa4ad]">Analisi mensile acquisizione e conversione</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-[#0c0c0c] rounded-[10px] px-4 py-2.5 text-[13px] text-[#9aa4ad]">
            Lead Totali
            <span className="block text-lg font-semibold text-[#00e5ff]">{monthlyData.totalLeads.toLocaleString()}</span>
          </div>
          <div className="bg-[#0c0c0c] rounded-[10px] px-4 py-2.5 text-[13px] text-[#9aa4ad]">
            Conversioni
            <span className="block text-lg font-semibold text-[#00e5ff]">{monthlyData.totalConversions.toLocaleString()}</span>
          </div>
          <div className="bg-[#0c0c0c] rounded-[10px] px-4 py-2.5 text-[13px] text-[#9aa4ad]">
            CR Medio
            <span className="block text-lg font-semibold text-[#00e5ff]">{monthlyData.avgCR}%</span>
          </div>
        </div>
      </div>

      <div className="relative h-[420px]">
        <Line options={options} data={data} />
      </div>
    </div>
  );
};

export default LeadPerformanceChart;
