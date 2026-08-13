import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/lib/poUtils";
import { getMilestoneStatus, MILESTONE_BADGES, MILESTONE_STATUS_LABELS } from "@/lib/paymentScheduleUtils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function PaymentCalendar({ milestones, pos = [], onMilestoneClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Build calendar grid
  const weeks = [];
  let day = 1;
  for (let i = 0; i < 6; i++) {
    const week = [];
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < startWeekday) {
        week.push(null);
      } else if (day > daysInMonth) {
        week.push(null);
      } else {
        week.push(new Date(year, month, day));
        day++;
      }
    }
    weeks.push(week);
    if (day > daysInMonth) break;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Format a local Date to YYYY-MM-DD without UTC conversion (avoids off-by-one in non-UTC timezones)
  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getMilestonesForDate = (date) => {
    if (!date) return [];
    const dateStr = toISODate(date);
    return milestones.filter((m) => {
      if (m.status === "cancelled" || m.status === "paid") return false;
      return m.due_date === dateStr;
    });
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentMonth(new Date()); setSelectedDate(null); };

  const monthLabel = currentMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedMilestones = selectedDate ? getMilestonesForDate(selectedDate) : [];
  const poMap = {};
  pos.forEach((p) => { poMap[p.id] = p; });

  return (
    <div className="space-y-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <h3 className="font-semibold text-slate-800 text-sm min-w-[140px] text-center">{monthLabel}</h3>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Button size="sm" variant="ghost" onClick={goToday} className="text-xs">Today</Button>
      </div>

      {/* Calendar grid */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50">
          {weekdayLabels.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-500 py-2 border-b border-slate-200">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => {
              const ms = getMilestonesForDate(date);
              const isToday = date && date.getTime() === today.getTime();
              const isSelected = date && selectedDate && date.getTime() === selectedDate.getTime();
              const hasOverdue = date && ms.some((m) => getMilestoneStatus(m, poMap[m.po_id]) === "overdue");
              return (
                <div
                  key={di}
                  onClick={() => date && (ms.length > 0 ? setSelectedDate(date) : null)}
                  className={`min-h-[72px] border-b border-r border-slate-100 p-1.5 ${date ? (ms.length > 0 ? "cursor-pointer hover:bg-slate-50" : "") : "bg-slate-50/30"} ${isSelected ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}
                >
                  {date && (
                    <>
                      <div className={`text-xs ${isToday ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold" : "text-slate-400"}`}>{date.getDate()}</div>
                      {ms.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {ms.slice(0, 2).map((m) => {
                            const status = getMilestoneStatus(m, poMap[m.po_id]);
                            const badge = MILESTONE_BADGES[status];
                            return (
                              <div key={m.id} className={`text-[10px] truncate px-1 py-0.5 rounded ${badge.color} flex items-center gap-1`}>
                                <span className={`w-1 h-1 rounded-full ${badge.dot} flex-shrink-0`} />
                                <span className="truncate">{formatINR(m.calculated_amount).replace("₹", "₹")}</span>
                              </div>
                            );
                          })}
                          {ms.length > 2 && <div className="text-[10px] text-slate-400 px-1">+{ms.length - 2} more</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date details */}
      {selectedDate && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-800 text-sm">{formatDate(toISODate(selectedDate))}</h4>
            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          {selectedMilestones.length === 0 ? (
            <div className="text-sm text-slate-400">No payments due on this date.</div>
          ) : (
            <div className="space-y-2">
              {selectedMilestones.map((m) => {
                const po = poMap[m.po_id] || {};
                const status = getMilestoneStatus(m, po);
                const badge = MILESTONE_BADGES[status];
                return (
                  <div key={m.id} onClick={() => onMilestoneClick?.(m)} className="flex items-center justify-between border border-slate-100 rounded-lg p-3 hover:bg-slate-50 cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-slate-800">{m.milestone_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {m.po_number} · {m.vendor_name} · {m.institute_name}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="font-semibold text-slate-800">{formatINR(m.calculated_amount)}</div>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {MILESTONE_STATUS_LABELS[status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}