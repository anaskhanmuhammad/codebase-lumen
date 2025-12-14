const { Badge } = require("lucide-react");

// Badge component for severity
export default function SeverityBadge({ severity }) {
  const sev = severity?.toUpperCase() || "UNKNOWN";

  const colorClass =
    sev === "ERROR"
      ? "border-red-500 text-red-600"
      : sev === "WARNING"
      ? "border-amber-500 text-amber-600"
      : sev === "INFO"
      ? "border-blue-500 text-blue-600"
      : "border-slate-400 text-slate-500";

  return (
    <Badge variant="outline" className={colorClass}>
      {sev}
    </Badge>
  );
}
