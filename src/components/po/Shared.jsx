import React from "react";
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/poUtils";

export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

export const PaymentBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_STATUS_COLORS[status] || "bg-slate-100"}`}>
    {PAYMENT_STATUS_LABELS[status] || status}
  </span>
);

export const StatCard = ({ label, value, sub, icon: Icon, accent = "slate", onClick }) => {
  const accents = {
    slate: "from-slate-50 to-slate-100 text-slate-700",
    blue: "from-blue-50 to-blue-100 text-blue-700",
    amber: "from-amber-50 to-amber-100 text-amber-700",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700",
    red: "from-red-50 to-red-100 text-red-700",
    purple: "from-purple-50 to-purple-100 text-purple-700",
    indigo: "from-indigo-50 to-indigo-100 text-indigo-700",
  };
  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${accents[accent]} rounded-xl p-4 border border-white shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, sub, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <Icon className="w-12 h-12 text-slate-300 mb-3" />}
    <div className="text-slate-600 font-medium">{title}</div>
    {sub && <div className="text-sm text-slate-400 mt-1">{sub}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);