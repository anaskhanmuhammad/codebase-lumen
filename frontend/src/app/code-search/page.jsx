"use client";
import { useState } from "react";
import {
  Search,
  Code,
  ExternalLink,
  Loader2,
  AlertCircle,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function SourcegraphSearch() {
  const [code, setCode] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchCode = async () => {
    if (!code.trim()) {
      setError("Please enter some code to search");
      return;
    }

    if (!githubToken.trim()) {
      setError(
        "Please enter your GitHub Personal Access Token. You can create one at: https://github.com/settings/tokens"
      );
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const searchQuery = code.trim().substring(0, 50);
      const query = encodeURIComponent(searchQuery);

      const response = await fetch(
        `https://api.github.com/search/code?q=${query}&per_page=20`,
        {
          method: "GET",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Invalid GitHub token. Please check your token and try again."
          );
        }
        if (response.status === 403) {
          const rateLimitReset = response.headers.get("X-RateLimit-Reset");
          const resetDate = rateLimitReset
            ? new Date(parseInt(rateLimitReset) * 1000)
            : null;
          throw new Error(
            `Rate limit exceeded. ${
              resetDate
                ? `Try again after ${resetDate.toLocaleTimeString()}`
                : "Please try again later."
            }`
          );
        }
        if (response.status === 422) {
          throw new Error(
            "Search query is too complex. Try a simpler code snippet."
          );
        }
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        setError(
          "No results found. Try a different code snippet or make sure it exists in public repositories."
        );
      } else {
        const matches = data.items.map((item) => ({
          repository: item.repository.full_name,
          file: item.path,
          url: item.html_url,
          score: item.score,
          repoUrl: item.repository.html_url,
        }));
        setResults(matches);
      }
    } catch (err) {
      setError(err.message || "Failed to search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      searchCode();
    }
  };

  return (
    <div className="min-h-screen  p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Code className="w-10 h-10" />
            <h1 className="text-4xl font-bold text-white">
              GitHub Code Search
            </h1>
          </div>
          <p className="text-gray-400 mb-2">
            Search for code across millions of public repositories
          </p>
          <p className="text-gray-500 text-sm">
            Powered by GitHub's Code Search API
          </p>
        </div>

        {/* GitHub Token Card */}
        <Card className="mb-6 border-slate-700 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Github className="w-5 h-5" />
              GitHub Personal Access Token
            </CardTitle>
            <CardDescription>
              Required for authentication. Create one at{" "}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className=" underline"
              >
                github.com/settings/tokens
              </a>{" "}
              (no scopes needed for public search)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </CardContent>
        </Card>

        {/* Search Card */}
        <Card className="mb-6 border-slate-700 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">
              Paste your code snippet
            </CardTitle>
            <CardDescription>
              Enter code to find similar implementations in open source
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="// Enter code to search...&#10;function example() {&#10;  return 'hello world';&#10;}"
            />
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">
                Press Ctrl + Enter to search
              </p>
              <Button onClick={searchCode} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search GitHub
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-white">Results</h2>
              <Badge variant="secondary">
                {results.length} {results.length === 1 ? "match" : "matches"}
              </Badge>
            </div>

            {results.map((result, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Github className="w-4 h-4 " />
                        <CardTitle>{result.repository}</CardTitle>
                      </div>
                      <CardDescription className="font-mono text-sm">
                        {result.file}
                      </CardDescription>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-gray-400 border-slate-600"
                        >
                          Score: {result.score?.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild size="sm">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View File
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-gray-300 hover:bg-slate-800"
                      >
                        <a
                          href={result.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Repo
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && results.length === 0 && (
          <Card className="border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardContent className="py-16">
              <div className="text-center">
                <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">
                  Enter your GitHub token and code to start searching
                </p>
                <p className="text-gray-500 text-sm">
                  Need help? Check the{" "}
                  <a
                    href="https://docs.github.com/en/rest/search#search-code"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    GitHub API docs
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
