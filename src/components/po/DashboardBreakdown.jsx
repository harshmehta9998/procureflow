import React from "react";
import { TrendingUp } from "lucide-react";

const accents = {
  slate: "from-slate-50 to-slate-100",
  blue: "from-blue-50 to-blue-100",
  amber: "from-amber-50 to-amber-100",
  emerald: "from-emerald-50 to-emerald-100",
  red: "from-red-50 to-red-100",
  purple: "from-purple-50 to-purple-100",
  indigo: "from-indigo-50 to-indigo-100",
};

const textColors = {
  slate: "text-slate-700", blue: "text-blue-700", amber: "text-amber-700",
  emerald: "text-emerald-700", red: "text-red-700", purple: "text-purple-700", indigo: "text-indigo-700",
};

const BreakdownCard = ({ label, count, amount, accent = "slate", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-gradient-to-br ${accents[accent]} rounded-xl p-4 border border-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all`}
  >
    <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
    <div className="flex items-baseline gap-2 mt-1">
      <span className="text-2xl font-bold text-slate-800">{count}</span>
      <span className="text-xs text-slate-500">POs</span>
    </div>
    {amount != null && <div className={`text-xs font-medium mt-1 ${textColors[accent]}`}>{amount}</div>}
  </div>
);

export const BreakdownPair = ({ title, left, right }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
      <TrendingUp className="w-4 h-4 text-slate-400" /> {title}
    </h3>
    <div className="grid grid-cols-2 gap-3">
      <BreakdownCard {...left} />
      <BreakdownCard {...right} />
    </div>
  </div>
);

export default BreakdownPair;