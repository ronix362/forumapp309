"use client";

import { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ActivityData {
  day: string; 
  count: number;
}

export default function ActivityChart({ data }: { data: ActivityData[] }) {
  // 1. State to track if the component has actually mounted in the user's browser
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 2. If it hasn't mounted yet (Server-Side Rendering), return a skeleton placeholder.
  // This physically prevents Recharts from trying to measure a non-existent DOM.
  if (!isMounted) {
    return (
      <div className="w-full h-[350px] bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[350px] bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">User Activity</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400">
          No activity data yet.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">User Activity</h3>
      </div>
      
      <div className="p-4 pt-6 w-full">
        
        {/* 3. THE ULTIMATE FIX: 
            - width="99%" prevents ResizeObserver infinite loops.
            - height={250} passes a STRICT NUMBER instead of "100%". 
              Recharts no longer has to guess its height from the parent div.
        */}
        <ResponsiveContainer width="99%" height={250}>
          <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
              dataKey="day" 
              tickFormatter={(str) => {
                try {
                  return format(parseISO(str), 'MMM d');
                } catch (e) {
                  return str;
                }
              }}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            
            <YAxis 
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelFormatter={(label) => {
                try {
                  return format(parseISO(label), 'EEEE, MMM d');
                } catch (e) {
                  return label;
                }
              }}
            />
            
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCount)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}