"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  PencilLine,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
  }
}

function statusBadge(apiKey) {
  if (!apiKey.isValidated) {
    return { label: "Not validated", className: "bg-amber-100 text-amber-800" };
  }
  const status = (apiKey.validationStatus || "").toLowerCase();
  if (status.includes("valid")) {
    return { label: "Validated", className: "bg-green-100 text-green-800" };
  }
  return { label: apiKey.validationStatus || "Invalid", className: "bg-red-100 text-red-800" };
}

export default function ApiKeysPage() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [providerOptions, setProviderOptions] = useState([]);

  const [provider, setProvider] = useState("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState("");
  const [rotateForId, setRotateForId] = useState("");
  const [rotateKeyValue, setRotateKeyValue] = useState("");
  const [showRotateKey, setShowRotateKey] = useState(false);

  const activeCount = useMemo(
    () => records.filter((row) => row.isActive).length,
    [records]
  );

  const fetchKeys = async () => {
    try {
      setError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load API keys.");
      }

      const data = await res.json();
      setRecords(data.apiKeys || []);
    } catch (err) {
      setError(err.message || "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/llms`);

      if (!res.ok) {
        throw new Error("Failed to load providers.");
      }

      const data = await res.json();
      const uniqueProviders = [];
      const seenProviders = new Set();

      for (const llm of data.llms || []) {
        const providerName = (llm.provider || "").trim();
        if (!providerName || seenProviders.has(providerName)) {
          continue;
        }

        seenProviders.add(providerName);
        uniqueProviders.push({ value: providerName, label: providerName });
      }

      setProviderOptions(uniqueProviders);

      if (uniqueProviders.length > 0) {
        setProvider((current) =>
          uniqueProviders.some((option) => option.value === current)
            ? current
            : uniqueProviders[0].value
        );
      } else {
        setProvider("");
      }
    } catch (err) {
      setError(err.message || "Failed to load providers.");
    } finally {
      setProvidersLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("API key is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          name: name.trim() || null,
          apiKey: apiKey.trim(),
          testBeforeSave: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save API key.");
      }

      setApiKey("");
      setName("");
      setShowApiKey(false);
      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to save API key.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetest = async (keyId) => {
    try {
      setActionLoadingId(keyId);
      setError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys/${keyId}/retest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to validate key.");
      }

      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to validate key.");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleToggleActive = async (row) => {
    try {
      setActionLoadingId(row.keyId);
      setError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys/${row.keyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !row.isActive }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update key state.");
      }

      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to update key state.");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleDelete = async (keyId) => {
    const confirmed = window.confirm("Delete this API key? This action cannot be undone.");
    if (!confirmed) return;

    try {
      setActionLoadingId(keyId);
      setError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys/${keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete key.");
      }

      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to delete key.");
    } finally {
      setActionLoadingId("");
    }
  };

  const handleRotate = async (keyId) => {
    if (!rotateKeyValue.trim()) {
      setError("Enter the new API key before rotating.");
      return;
    }

    try {
      setActionLoadingId(keyId);
      setError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/user-api-keys/${keyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          apiKey: rotateKeyValue.trim(),
          testAfterRotate: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rotate key.");
      }

      setRotateForId("");
      setRotateKeyValue("");
      setShowRotateKey(false);
      await fetchKeys();
    } catch (err) {
      setError(err.message || "Failed to rotate key.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        </div>
        <Badge variant="outline" className="text-xs">
          Active keys: {activeCount}
        </Badge>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Add New API Key</h2>
        </div>

        <form onSubmit={handleSaveKey} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                disabled={saving || providersLoading || providerOptions.length === 0}
              >
                {providerOptions.length === 0 ? (
                  <option value="">No supported providers found</option>
                ) : (
                  providerOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Label (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Primary key"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste provider API key"
                disabled={saving}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApiKey((prev) => !prev)}
                disabled={saving}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test & Save
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border bg-card p-4 md:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold">Connected Keys</h2>
          <Button variant="outline" size="sm" onClick={fetchKeys} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading keys...
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No API keys added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((row) => {
              const status = statusBadge(row);
              return (
                <div key={row.keyId} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {row.provider}
                      </Badge>
                      {row.name ? <Badge variant="outline">{row.name}</Badge> : null}
                      <span className="text-xs text-muted-foreground">{row.maskedKey || "Stored securely"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={status.className}>{status.label}</Badge>
                      {row.isActive ? (
                        <Badge variant="outline" className="border-green-200 text-green-700">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 text-slate-600">
                          <ShieldX className="h-3 w-3 mr-1" /> Inactive
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div>Last validation: {formatDate(row.lastValidationAt)}</div>
                    <div>Last used: {formatDate(row.lastUsedAt)}</div>
                    {row.validationError ? (
                      <div className="md:col-span-2 text-red-600">Validation error: {row.validationError}</div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetest(row.keyId)}
                      disabled={actionLoadingId === row.keyId}
                    >
                      {actionLoadingId === row.keyId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Retest
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(row)}
                      disabled={actionLoadingId === row.keyId}
                    >
                      {row.isActive ? "Deactivate" : "Activate"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRotateForId(row.keyId);
                        setRotateKeyValue("");
                        setShowRotateKey(false);
                      }}
                    >
                      <PencilLine className="h-4 w-4" />
                      Rotate
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(row.keyId)}
                      disabled={actionLoadingId === row.keyId}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  {rotateForId === row.keyId ? (
                    <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                      <Label className="text-xs">New API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showRotateKey ? "text" : "password"}
                          value={rotateKeyValue}
                          onChange={(e) => setRotateKeyValue(e.target.value)}
                          placeholder="Paste new key"
                        />
                        <Button type="button" variant="outline" onClick={() => setShowRotateKey((prev) => !prev)}>
                          {showRotateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setRotateForId("");
                            setRotateKeyValue("");
                            setShowRotateKey(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleRotate(row.keyId)}
                          disabled={actionLoadingId === row.keyId}
                        >
                          {actionLoadingId === row.keyId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Rotation
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
