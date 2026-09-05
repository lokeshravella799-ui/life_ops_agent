import React from 'react';
import type { HistoryItem } from '../../types/agent';
import { MessageSquare, ShoppingBag, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';

interface SidebarHistoryProps {
  items: HistoryItem[];
  selectedId?: string;
  onSelectItem: (item: HistoryItem) => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  items,
  selectedId,
  onSelectItem,
}) => {
  const todayItems = items.filter((i) => i.category === 'today');
  const yesterdayItems = items.filter((i) => i.category === 'yesterday');
  const earlierItems = items.filter((i) => i.category === 'earlier' || (!['today', 'yesterday', 'purchases', 'bookings'].includes(i.category || '')));
  const purchaseItems = items.filter((i) => i.category === 'purchases');
  const bookingItems = items.filter((i) => i.category === 'bookings');

  const renderSection = (title: string, sectionItems: HistoryItem[]) => {
    if (sectionItems.length === 0) return null;

    return (
      <div className="mb-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 px-3 mb-2 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{sectionItems.length}</span>
        </h4>
        <div className="space-y-1">
          {sectionItems.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`w-full group text-left px-3 py-2 rounded-xl transition-all duration-200 flex items-center justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-500/40 text-purple-900 dark:text-purple-200 shadow-sm'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-950 dark:hover:text-zinc-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      item.type === 'purchase'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20'
                        : item.type === 'booking'
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/20'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20'
                    }`}
                  >
                    {item.type === 'purchase' ? (
                      <ShoppingBag className="w-3.5 h-3.5" />
                    ) : item.type === 'booking' ? (
                      <Calendar className="w-3.5 h-3.5" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-purple-900 dark:text-cyan-300' : 'text-slate-800 dark:text-zinc-200 group-hover:text-slate-950 dark:group-hover:text-white'}`}>
                        {item.title}
                      </p>
                      {item.date && (
                        <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 shrink-0">
                          {item.date}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-normal">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                  )}
                  {item.amount && (
                    <span className="text-[11px] font-mono font-medium text-slate-700 dark:text-zinc-300">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  )}
                  {item.status && (
                    <span className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {item.status}
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className="py-8 text-center px-4">
        <p className="text-xs text-slate-400 dark:text-zinc-500 font-light">
          No previous sessions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pr-1">
      {renderSection('Today', todayItems)}
      {renderSection('Yesterday', yesterdayItems)}
      {renderSection('Earlier Sessions', earlierItems)}
      {renderSection('Previous Purchases', purchaseItems)}
      {renderSection('Bookings', bookingItems)}
    </div>
  );
};
