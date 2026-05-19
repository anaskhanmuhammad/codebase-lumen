"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SonarResultsView from "@/app/compare/_components/RawResults/SonarResultsView";
import { fetchRepositoryBranches, scanRepository } from "@/app/compare/actions/analyzeCode";

export default function RepositoryScannerPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [sarif, setSarif] = useState(null);
  const [error, setError] = useState("");

  const handleFetchBranches = async () => {
    if (!repoUrl.trim()) return;

    setLoadingBranches(true);
    setError("");
    setSummary(null);
    setSarif(null);

    const response = await fetchRepositoryBranches(repoUrl.trim());
    if (!response?.success) {
      setError(response?.error || "Failed to fetch branches");
      setLoadingBranches(false);
      return;
    }

    const branchList = response.branches || [];
    setBranches(branchList);
    setSelectedBranch(response.defaultBranch || branchList[0] || "");
    setLoadingBranches(false);
  };

  const handleScan = async () => {
    if (!repoUrl.trim() || !selectedBranch) return;

    setScanning(true);
    setError("");
    setSummary(null);
    setSarif(null);

    const response = await scanRepository(repoUrl.trim(), selectedBranch);
    if (!response?.success) {
      setError(response?.error || "Repository scan failed");
      setScanning(false);
      return;
    }

    setSummary(response.summary || null);
    setSarif(response.sarif || null);
    setScanning(false);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Repository Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Scan a public GitHub repository with SonarQube and review detailed results.
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">GitHub Repository URL</label>
            <Input
              placeholder="https://github.com/owner/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleFetchBranches}
              disabled={!repoUrl.trim() || loadingBranches}
              variant="outline"
            >
              {loadingBranches ? "Fetching..." : "Fetch Branches"}
            </Button>

            {branches.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                <Badge variant="secondary">{branches.length} branches</Badge>
              </div>
            )}

            <Button onClick={handleScan} disabled={!repoUrl.trim() || !selectedBranch || scanning}>
              {scanning ? "Scanning..." : "Start Scan"}
            </Button>
          </div>
        </Card>

        {summary && (
          <Card className="p-5 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Issues</p>
              <p className="text-2xl font-bold">{summary.total || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold text-red-600">{summary.critical || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Major</p>
              <p className="text-2xl font-bold text-amber-600">{summary.major || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Minor/Info</p>
              <p className="text-2xl font-bold text-blue-600">
                {(summary.minor || 0) + (summary.info || 0)}
              </p>
            </div>
          </Card>
        )}

        {scanning && (
          <Card className="p-5 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Scanning repository...</p>
          </Card>
        )}

        {sarif && (
          <Card className="p-6">
            <SonarResultsView payload={sarif} code="" />
          </Card>
        )}
      </div>
    </div>
  );
}
