"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const collectionVelocity = [
  { hour: "00", reports: 42 },
  { hour: "03", reports: 58 },
  { hour: "06", reports: 49 },
  { hour: "09", reports: 83 },
  { hour: "12", reports: 72 },
  { hour: "15", reports: 108 },
  { hour: "18", reports: 96 },
  { hour: "21", reports: 124 },
  { hour: "24", reports: 112 },
];

export function CollectionChart() {
  return (
    <div style={{ width: "100%", height: 116 }} aria-label="Reports collected by hour">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={collectionVelocity} margin={{ top: 8, right: 4, left: -29, bottom: 0 }}>
          <defs>
            <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4cc9e8" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#4cc9e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#667b89", fontSize: 8 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#667b89", fontSize: 8 }} />
          <Tooltip
            contentStyle={{ background: "#0b141c", border: "1px solid #29404f", borderRadius: 6, fontSize: 9 }}
            labelStyle={{ color: "#718391" }}
          />
          <Area type="monotone" dataKey="reports" stroke="#4cc9e8" strokeWidth={1.5} fill="url(#collectionFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
