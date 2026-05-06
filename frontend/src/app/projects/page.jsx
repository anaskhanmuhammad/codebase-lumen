"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  FolderOpen,
  Calendar,
  Code2,
  GitCompareArrows,
  Loader2,
  X,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ─── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreated, getToken }) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectName: projectName.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create project.");
        return;
      }

      onCreated(data.project);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="projectName">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My API Security Audit"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none"
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
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
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Projects Page ────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { getToken } = useAuth();

  const [projects, setProjects] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch languages for filter dropdown
  useEffect(() => {
    async function fetchLanguages() {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND_URL}/projects/languages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLanguages(data.languages || []);
        }
      } catch (err) {
        console.error("Failed to fetch languages:", err);
      }
    }
    fetchLanguages();
  }, [getToken]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (languageFilter) params.set("language", languageFilter);

      const res = await fetch(`${BACKEND_URL}/projects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken, page, debouncedSearch, languageFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectCreated = (newProject) => {
    setShowModal(false);
    // Optimistically prepend the new project then refetch to get accurate total
    setProjects((prev) => [newProject, ...prev]);
    setTotal((prev) => prev + 1);
    fetchProjects();
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <>
      {showModal && (
        <NewProjectModal
          getToken={getToken}
          onClose={() => setShowModal(false)}
          onCreated={handleProjectCreated}
        />
      )}

      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              {total} project{total !== 1 ? "s" : ""} total
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              value={languageFilter}
              onChange={(e) => {
                setLanguageFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none rounded-lg border border-input bg-background pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background cursor-pointer transition-colors min-w-[160px]"
            >
              <option value="">All Languages</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No projects found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              {debouncedSearch || languageFilter
                ? "Try adjusting your search or filter criteria."
                : "Create your first project to get started."}
            </p>
            {!debouncedSearch && !languageFilter && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Link
                  key={project.projectId}
                  href={`/projects/${project.projectId}`}
                  className="group relative rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-ring/30 transition-all duration-200 block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <FolderOpen className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold truncate text-sm">
                        {project.projectName}
                      </h3>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
                    {project.topLanguage && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium">
                        <Code2 className="h-3 w-3" />
                        {project.topLanguage}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <GitCompareArrows className="h-3 w-3" />
                      {project._count?.comparisons || 0} comparisons
                    </span>
                    <span className="inline-flex items-center gap-1 ml-auto">
                      <Calendar className="h-3 w-3" />
                      {formatDate(project.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground px-3">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
