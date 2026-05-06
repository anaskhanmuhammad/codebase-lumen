"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GitCompareArrows,
  Plus,
  Loader2,
  Calendar,
  Code2,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Circle,
  X,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    failed: {
      icon: AlertCircle,
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
    },
    in_progress: {
      icon: Clock,
      label: "In Progress",
      className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    },
  };

  const {
    icon: Icon,
    label,
    className,
  } = map[status?.toLowerCase()] ?? {
    icon: Circle,
    label: status ?? "Pending",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── New Comparison Modal ───────────────────────────────────────────────────

function NewComparisonModal({ onClose, onCreated, getToken, projectId }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Human vs LLM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Comparison name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch(
        `${BACKEND_URL}/projects/${projectId}/comparisons`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            type,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create comparison.");
        return;
      }

      onCreated(data.comparison);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">New Comparison</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="name">
              Comparison Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Authentication Setup"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="type">
              Comparison Type <span className="text-destructive">*</span>
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors cursor-pointer"
            >
              <option value="Human vs LLM">Human vs LLM</option>
              <option value="LLM vs LLM">LLM vs LLM</option>
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Comparison
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { getToken } = useAuth();
  const { projectId } = useParams();
  const router = useRouter();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Fetch the project data
  const fetchProject = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load project.");
        return;
      }
      const data = await res.json();
      setProject(data.project);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, projectId]);

  const handleCreated = () => {
    setShowModal(false);
    fetchProject(); // Refresh the list
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>
    );
  }

  const comparisons = project?.comparisons ?? [];
  const count = project?._count?.comparisons ?? 0;

  return (
    <>
      {showModal && (
        <NewComparisonModal
          getToken={getToken}
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="space-y-6">
        <button
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Projects
        </button>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3 shrink-0">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  {project.projectName}
                </h1>
                {project.description && (
                  <p className="text-muted-foreground text-sm mt-1 max-w-prose">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  {project.topLanguage && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium">
                      <Code2 className="h-3 w-3" />
                      {project.topLanguage}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {formatDate(project.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitCompareArrows className="h-3 w-3" />
                    {count} comparison{count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="h-4 w-4" />
              Start New Comparison
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Comparisons</h2>

          {comparisons.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <GitCompareArrows className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No comparisons yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start a new comparison to analyse and compare code samples in
                this project.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Start New Comparison
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                      Language
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisons.map((c) => (
                    <tr
                      key={c.comparisonId}
                      onClick={() =>
                        router.push(
                          `/projects/${projectId}/comparisons/${c.comparisonId}`,
                        )
                      }
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium">
                        {c.name || (
                          <span className="text-muted-foreground italic">
                            Unnamed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell capitalize">
                        {c.type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {c.language?.languageName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-right hidden sm:table-cell">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
