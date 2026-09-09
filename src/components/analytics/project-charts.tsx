"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AssigneeLoad,
  StateSlice,
  TrendPoint,
} from "@/db/queries/analytics";

/**
 * The three project charts.
 *
 * Every colour is a `var(--token)` string rather than a literal, so these
 * reskin with the rest of the app in phase 13. State slice colours are the
 * exception the conventions already allow: they come from the states table.
 */

const AXIS = {
  stroke: "var(--text-400)",
  fontSize: 10,
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--bg-90)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "6px",
  fontSize: "11px",
  color: "var(--text-100)",
} as const;

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border-subtle p-3">
      <h2 className="text-2xs font-medium tracking-wide text-text-400 uppercase">
        {title}
      </h2>
      <div className="mt-3 h-56 w-full">{children}</div>
    </section>
  );
}

export function OpenClosedTrend({ points }: { points: TrendPoint[] }) {
  return (
    <Panel title="Created vs completed · last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 4" />
          <XAxis
            dataKey="day"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            // Thirty labels do not fit; every fifth day is legible and enough.
            interval={4}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-300)" }} />
          <Line
            type="monotone"
            dataKey="created"
            name="Created"
            stroke="var(--accent)"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="var(--success)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function StateDistribution({ slices }: { slices: StateSlice[] }) {
  const data = slices.filter((slice) => slice.count > 0);

  return (
    <Panel title="State distribution">
      {data.length === 0 ? (
        <p className="flex h-full items-center justify-center text-xs text-text-400">
          No issues yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              stroke="var(--bg-100)"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.stateId} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-300)" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

export function AssigneeLoadChart({ rows }: { rows: AssigneeLoad[] }) {
  return (
    <Panel title="Issues per assignee">
      {rows.length === 0 ? (
        <p className="flex h-full items-center justify-center text-xs text-text-400">
          Nothing is assigned yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--bg-80)" }} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text-300)" }} />
            <Bar dataKey="open" name="Open" stackId="a" fill="var(--accent)" />
            <Bar dataKey="completed" name="Completed" stackId="a" fill="var(--success)" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
