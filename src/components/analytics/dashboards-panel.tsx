"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { STAT_GRID_4 } from "@/lib/admin/stat-value";
import type { AnalyticsSummary } from "@/lib/analytics/queries";

const COLORS = ["#0071e3", "#111111", "#5c5c66", "#25d366", "#a78bfa"];

type ChartKind = "line" | "bar" | "area" | "pie";

export function DashboardsPanel({ summary }: { summary: AnalyticsSummary }) {
  const [chart, setChart] = useState<ChartKind>("area");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const series = useMemo(() => {
    const days = new Map<string, Record<string, number | string>>();
    for (const row of summary.events_by_day) {
      if (eventFilter !== "all" && row.event_type !== eventFilter) continue;
      const cur = days.get(row.day) ?? { day: row.day };
      cur[row.event_type] = row.count;
      days.set(row.day, cur);
    }
    return [...days.values()].sort((a, b) =>
      String(a.day).localeCompare(String(b.day)),
    );
  }, [summary.events_by_day, eventFilter]);

  const pieData = [
    { name: "Page views", value: summary.page_views },
    { name: "Cliques", value: summary.product_clicks },
    { name: "Aportes start", value: summary.contribution_starts },
    { name: "Signups", value: summary.signups },
  ].filter((d) => d.value > 0);

  const empty = series.length === 0 && pieData.length === 0;

  return (
    <div className="space-y-6">
      <div className={STAT_GRID_4}>
        {[
          ["Page views", summary.page_views],
          ["Cliques produto", summary.product_clicks],
          ["Inícios de aporte", summary.contribution_starts],
          ["Novos usuários", summary.new_users || summary.signups],
        ].map(([label, value]) => (
          <StatCard
            key={String(label)}
            label={String(label)}
            value={Number(value).toLocaleString("pt-BR")}
            className="relative overflow-hidden shadow-[0_20px_50px_rgba(17,17,17,0.08)] [transform:perspective(800px)_rotateX(2deg)]"
          />
        ))}
      </div>

      <Card className="space-y-4 shadow-[0_24px_60px_rgba(17,17,17,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Eventos</h3>
            <p className="text-sm text-[var(--ink-muted)]">
              Filtros e tipo de gráfico dinâmico
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="all">Todos eventos</option>
              <option value="page_view">page_view</option>
              <option value="product_click">product_click</option>
              <option value="contribution_start">contribution_start</option>
              <option value="signup">signup</option>
            </select>
            {(["line", "bar", "area", "pie"] as ChartKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setChart(k)}
                className={
                  chart === k
                    ? "rounded-full bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-[var(--line)] px-3 py-2 text-sm font-semibold"
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 w-full">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[20px] bg-[var(--bg-subtle)] text-center">
              <p className="text-lg font-bold">Sem dados ainda</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--ink-muted)]">
                Quando houver cliques no catálogo e novos cadastros, os gráficos
                aparecem aqui com a mesma estética premium.
              </p>
            </div>
          ) : chart === "pie" ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : chart === "bar" ? (
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ec" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="page_view" fill="#111111" radius={6} />
                <Bar dataKey="product_click" fill="#0071e3" radius={6} />
                <Bar dataKey="signup" fill="#a78bfa" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          ) : chart === "line" ? (
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ec" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="page_view" stroke="#111111" strokeWidth={2} />
                <Line type="monotone" dataKey="product_click" stroke="#0071e3" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ec" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="page_view" stroke="#111111" fill="#11111122" />
                <Area type="monotone" dataKey="product_click" stroke="#0071e3" fill="#0071e333" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
          <h3 className="text-lg font-bold">Top cliques</h3>
          <ul className="mt-3 space-y-2">
            {summary.top_clicked.length === 0 ? (
              <li className="text-sm text-[var(--ink-muted)]">Sem cliques ainda.</li>
            ) : (
              summary.top_clicked.map((p) => (
                <li key={p.product_id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <strong>{p.count}</strong>
                </li>
              ))
            )}
          </ul>
        </Card>
        <Card className="shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
          <h3 className="text-lg font-bold">Top por aportes</h3>
          <ul className="mt-3 space-y-2">
            {summary.top_aporte_products.length === 0 ? (
              <li className="text-sm text-[var(--ink-muted)]">Sem aportes confirmados.</li>
            ) : (
              summary.top_aporte_products.map((p) => (
                <li key={p.product_id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <strong>{p.count}</strong>
                </li>
              ))
            )}
          </ul>
        </Card>
        <Card className="shadow-[0_20px_50px_rgba(17,17,17,0.06)]">
          <h3 className="text-lg font-bold">SEO (placeholder)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Performance</span>
              <strong>{summary.seo_placeholder.performance}</strong>
            </li>
            <li className="flex justify-between">
              <span>Acessibilidade</span>
              <strong>{summary.seo_placeholder.accessibility}</strong>
            </li>
            <li className="flex justify-between">
              <span>SEO</span>
              <strong>{summary.seo_placeholder.seo}</strong>
            </li>
          </ul>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            Scores ilustrativos até integrar Lighthouse / Search Console.
          </p>
        </Card>
      </div>
    </div>
  );
}
