import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SEVERITY_COLORS = {
  ERROR: "#dc2626", // red-600
  WARNING: "#f59e0b", // amber-500
  INFO: "#2563eb", // blue-600
  UNKNOWN: "#64748b", // slate-500
};

export default function SeverityChart({ findings }) {
  const stats = { ERROR: 0, WARNING: 0, INFO: 0 };
  findings.forEach((f) => {
    const sev = f.extra?.severity?.toUpperCase();
    if (stats[sev] !== undefined) stats[sev]++;
  });

  const data = Object.entries(stats).map(([severity, count]) => ({
    severity,
    count,
  }));

  return (
    <div className="h-36 border rounded-lg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="severity" tick={{ fill: "currentColor" }} />
          <YAxis allowDecimals={false} tick={{ fill: "currentColor" }} />
          <Tooltip />
          <Bar dataKey="count">
            {data.map((entry, index) => (
              <Cell key={index} fill={SEVERITY_COLORS[entry.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
