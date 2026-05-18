"use client";
import ReactMarkdown from "react-markdown";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, ArrowLeft, Plus, Trash2, MessageCircle, SendHorizontal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, XCircle } from "lucide-react";

import CodeInputCard from "@/app/compare/_components/CodeInputCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import AnalyzerRawModal from "@/app/compare/_components/RawResults/AnalyzerRawModal";
import ComparisonWinner from "@/app/compare/_components/ComparisonWinner";

import { analyzeBandit } from "@/app/compare/actions/analyzeBandit";
import { analyzeSemgrep } from "@/app/compare/actions/analyzeSemgrep";
import { analyzeCode } from "@/app/compare/actions/analyzeCode";
import { analyzeAiServer } from "@/app/compare/actions/analyzeAiServer";
import LLMSelector from "@/app/compare/_components/LLMSelector";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

hljs.registerLanguage("python", python);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);

const LANG_DISPLAY = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  kotlin: "Kotlin",
  swift: "Swift",
  sql: "SQL",
  bash: "Bash",
};

const SUPPORTED_LANGS = Object.keys(LANG_DISPLAY);

function detectLanguage(code) {
  const text = (code || "").trim();
  if (!text) {
    return { language: null, confidence: 0, display: "Not detected" };
  }

  try {
    const result = hljs.highlightAuto(text, SUPPORTED_LANGS);
    const language = result.language || null;
    const confidence = result.relevance || 0;
    return {
      language,
      confidence,
      display: LANG_DISPLAY[language] || "Unknown",
    };
  } catch {
    return { language: null, confidence: 0, display: "Unknown" };
  }
}

export default function ComparisonPage() {
  const { getToken } = useAuth();
  const { projectId, comparisonId } = useParams();
  const router = useRouter();

  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [humanCode, setHumanCode] = useState("");
  const [llmCodes, setLlmCodes] = useState([""]);
  const [llmNames, setLlmNames] = useState([""]);
  const [llmCustomNames, setLlmCustomNames] = useState([""]);
  const [llmGeneratedBaselines, setLlmGeneratedBaselines] = useState([null]);
  const [llmGeneratedPrompts, setLlmGeneratedPrompts] = useState([null]);
  const [availableLlms, setAvailableLlms] = useState([]);

  const [promptText, setPromptText] = useState("");
  const [selectedPromptTargets, setSelectedPromptTargets] = useState([]);
  const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  // Raw payloads are stored code-wise: human, llm-0, llm-1, ...
  const [rawAnalyzerResponses, setRawAnalyzerResponses] = useState({});
  const [rawResultsModalState, setRawResultsModalState] = useState({
    isOpen: false,
    codeKey: null,
  });

  const [selectedAnalyses, setSelectedAnalyses] = useState({
    bandit: true,
    semgrep: false,
    sonar: false,
    aiServer: false,
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const fetchComparison = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load comparison.");
          return;
        }
        const data = await res.json();
        setComparison(data.comparison);

        const isCompleted = (data.comparison?.status || "").toLowerCase() === "completed";

        if (isCompleted) {
          const completedRes = await fetch(
            `${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}/completed-data`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (completedRes.ok) {
            const completedData = await completedRes.json();

            if (data.comparison.type === "Human vs LLM") {
              setHumanCode(completedData.humanSample?.codeContent || "");

              const llmSamples = completedData.llmSamples || [];
              setLlmCodes(llmSamples.map((sample) => sample.codeContent || ""));
              setLlmNames(llmSamples.map((sample) => sample.llm?.llmName || ""));
              setLlmCustomNames(llmSamples.map(() => ""));
              setLlmGeneratedBaselines(
                llmSamples.map((sample) => (sample.isOriginal ? sample.codeContent || "" : null))
              );
              setLlmGeneratedPrompts(llmSamples.map((sample) => sample.promptUsed || null));
            } else {
              const llmSamples = completedData.llmSamples || [];
              setLlmCodes(llmSamples.map((sample) => sample.codeContent || ""));
              setLlmNames(llmSamples.map((sample) => sample.llm?.llmName || ""));
              setLlmCustomNames(llmSamples.map(() => ""));
              setLlmGeneratedBaselines(
                llmSamples.map((sample) => (sample.isOriginal ? sample.codeContent || "" : null))
              );
              setLlmGeneratedPrompts(llmSamples.map((sample) => sample.promptUsed || null));
            }

            // Fetch analyzer results for all code samples
            const allSamples = [
              completedData.humanSample,
              ...(completedData.llmSamples || []),
            ].filter(Boolean);

            const rawByCode = {};
            const resultItems = [];

            // Map samples to codeKeys
            const codeKeyMap = {};
            if (completedData.humanSample) {
              codeKeyMap[completedData.humanSample.codeSampleId] = {
                codeKey: "human",
                label: "Human",
              };
            }
            (completedData.llmSamples || []).forEach((sample, idx) => {
              codeKeyMap[sample.codeSampleId] = {
                codeKey: `llm-${idx}`,
                label: sample.llm?.llmName || `LLM ${idx + 1}`,
              };
            });

            // Fetch analyzer results for each code sample
            await Promise.all(
              allSamples.map(async (sample) => {
                try {
                  const analyzerRes = await fetch(
                    `${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}/code-samples/${sample.codeSampleId}/analyzer-results`,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );

                  if (analyzerRes.ok) {
                    const analyzerData = await analyzerRes.json();
                    const { codeKey, label } = codeKeyMap[sample.codeSampleId];

                    // Transform results into analyzer payloads
                    const analyzers = {
                      bandit: null,
                      semgrep: null,
                      sonar: null,
                      aiServer: null,
                    };

                    analyzerData.results.forEach((result) => {
                      analyzers[result.analyzerType] = result.rawOutput;
                    });

                    rawByCode[codeKey] = {
                      codeKey,
                      label,
                      code: sample.codeContent || "",
                      analyzers,
                      vulnerabilities: Array.isArray(analyzerData.vulnerabilities)
                        ? analyzerData.vulnerabilities
                        : [],
                    };

                    resultItems.push({
                      codeKey,
                      label,
                    });
                  }
                } catch (err) {
                  console.warn(`Failed to fetch analyzer results for sample ${sample.codeSampleId}:`, err);
                }
              })
            );

            if (Object.keys(rawByCode).length > 0) {
              setRawAnalyzerResponses(rawByCode);
              setResults(resultItems);
            }
          }
        }

        if (!isCompleted && data.comparison.type === "LLM vs LLM") {
          setLlmCodes(["", ""]);
          setLlmNames(["", ""]);
          setLlmCustomNames(["", ""]);
          setLlmGeneratedBaselines([null, null]);
          setLlmGeneratedPrompts([null, null]);
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (projectId && comparisonId) fetchComparison();
  }, [projectId, comparisonId, getToken]);

  useEffect(() => {
    const fetchLlms = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/projects/llms`);
        if (!res.ok) {
          setAvailableLlms([]);
          return;
        }

        const data = await res.json();
        setAvailableLlms(Array.isArray(data.llms) ? data.llms : []);
      } catch {
        setAvailableLlms([]);
      }
    };

    fetchLlms();
  }, []);

  const loadChatHistory = async () => {
    try {
      setChatLoading(true);
      setChatError("");
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/comparisons/${comparisonId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load chat history.");
      }

      const history = await res.json();
      setChatMessages(Array.isArray(history) ? history : []);
    } catch (err) {
      setChatError(err.message || "Failed to load chat history.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatSending) return;

    const optimisticUserMessage = {
      messageId: `temp-user-${Date.now()}`,
      type: "user",
      messageText: message,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, optimisticUserMessage]);
    setChatInput("");
    setChatSending(true);
    setChatError("");

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/comparisons/${comparisonId}/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      const aiMessage = await res.json();
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setChatError(err.message || "Failed to send message.");
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!isChatOpen || !comparisonId) return;
    loadChatHistory();
  }, [isChatOpen, comparisonId]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages, isChatOpen, chatLoading]);

  const handleToggleAnalysis = (key, checked) => {
    setSelectedAnalyses((prev) => ({
      ...prev,
      [key]: checked === true,
    }));
  };

  const addLlmField = () => {
    setLlmCodes([...llmCodes, ""]);
    setLlmNames([...llmNames, ""]);
    setLlmCustomNames([...llmCustomNames, ""]);
    setLlmGeneratedBaselines([...llmGeneratedBaselines, null]);
    setLlmGeneratedPrompts([...llmGeneratedPrompts, null]);
  };

  const removeLlmField = (index) => {
    const newCodes = [...llmCodes];
    const newNames = [...llmNames];
    const newCustomNames = [...llmCustomNames];
    const newBaselines = [...llmGeneratedBaselines];
    const newPrompts = [...llmGeneratedPrompts];
    newCodes.splice(index, 1);
    newNames.splice(index, 1);
    newCustomNames.splice(index, 1);
    newBaselines.splice(index, 1);
    newPrompts.splice(index, 1);
    setLlmCodes(newCodes);
    setLlmNames(newNames);
    setLlmCustomNames(newCustomNames);
    setLlmGeneratedBaselines(newBaselines);
    setLlmGeneratedPrompts(newPrompts);
    setSelectedPromptTargets((prev) =>
      prev
        .filter((targetIndex) => targetIndex !== index)
        .map((targetIndex) => (targetIndex > index ? targetIndex - 1 : targetIndex))
    );
  };

  const updateLlmCode = (index, value) => {
    const newCodes = [...llmCodes];
    newCodes[index] = value;
    setLlmCodes(newCodes);
  };

  const updateLlmName = (index, name) => {
    const newNames = [...llmNames];
    newNames[index] = name;
    setLlmNames(newNames);

    const newBaselines = [...llmGeneratedBaselines];
    const newPrompts = [...llmGeneratedPrompts];
    newBaselines[index] = null;
    newPrompts[index] = null;
    setLlmGeneratedBaselines(newBaselines);
    setLlmGeneratedPrompts(newPrompts);
  };

  const updateLlmCustomName = (index, customName) => {
    const newCustomNames = [...llmCustomNames];
    newCustomNames[index] = customName;
    setLlmCustomNames(newCustomNames);
  };

  const getLlmDisplayName = (index) => llmNames[index] || `LLM ${index + 1}`;

  const getLlmBenchmarkState = (index) => {
    const baseline = llmGeneratedBaselines[index];
    const hasGeneratedBaseline = typeof baseline === "string";
    const isOriginal = hasGeneratedBaseline && llmCodes[index] === baseline;
    const isAltered = hasGeneratedBaseline && !isOriginal;
    return {
      hasGeneratedBaseline,
      isOriginal,
      isAltered,
      promptUsed: llmGeneratedPrompts[index] || null,
    };
  };

  const getConfiguredLlmCards = () => {
    return llmCodes.map((code, index) => {
      const llmName = llmNames[index];
      const llmMeta = availableLlms.find((row) => row.llmName === llmName) || null;
      return {
        index,
        code,
        llmName,
        label: getLlmDisplayName(index),
        provider: llmMeta?.provider || null,
        modelIdentifier: llmMeta?.modelIdentifier || null,
      };
    });
  };

  const togglePromptTarget = (index) => {
    setSelectedPromptTargets((prev) =>
      prev.includes(index) ? prev.filter((id) => id !== index) : [...prev, index]
    );
  };

  const handleGenerateFromPrompt = async () => {
    if (isCompletedComparison) return;

    if (!promptText.trim()) {
      setError("Prompt is required before generating code.");
      return;
    }

    if (selectedPromptTargets.length === 0) {
      setError("Select at least one LLM card to generate code.");
      return;
    }

    const cards = getConfiguredLlmCards();
    const undefinedModelCards = cards.filter((card) => !card.llmName || !card.modelIdentifier);
    if (undefinedModelCards.length > 0) {
      setError(
        `Define models for all LLMs before prompt generation. Missing model for: ${undefinedModelCards
          .map((card) => card.label)
          .join(", ")}`
      );
      return;
    }

    const selectedCards = cards.filter((card) => selectedPromptTargets.includes(card.index));

    const selectedProviders = [...new Set(selectedCards.map((card) => (card.provider || "").trim()).filter(Boolean))];
    if (selectedProviders.length === 0) {
      setError("Could not resolve providers for selected LLMs.");
      return;
    }

    try {
      setIsGeneratingFromPrompt(true);
      setError("");

      const token = await getToken();
      const availabilityRes = await fetch(`${BACKEND_URL}/user-api-keys/available-providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!availabilityRes.ok) {
        const data = await availabilityRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to verify provider API availability.");
      }

      const availabilityData = await availabilityRes.json();
      const availableProviders = new Set(
        (availabilityData.providers || []).map((provider) => String(provider).toLowerCase())
      );

      const missingProviders = selectedProviders.filter(
        (provider) => !availableProviders.has(provider.toLowerCase())
      );

      if (missingProviders.length > 0) {
        throw new Error(
          `Provider API is not available for: ${missingProviders.join(", ")}. Add and validate API keys first.`
        );
      }

      const generationRes = await fetch(
        `${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            promptText,
            targets: selectedCards.map((card) => ({
              targetIndex: card.index,
              llmName: card.llmName,
            })),
          }),
        }
      );

      if (!generationRes.ok) {
        const data = await generationRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate code from selected LLMs.");
      }

      const generationData = await generationRes.json();
      const generationResults = Array.isArray(generationData.results) ? generationData.results : [];

      const nextCodes = [...llmCodes];
      const nextBaselines = [...llmGeneratedBaselines];
      const nextPrompts = [...llmGeneratedPrompts];
      const failedTargets = [];

      generationResults.forEach((result) => {
        if (result?.status === "success" && typeof result.generatedCode === "string") {
          nextCodes[result.targetIndex] = result.generatedCode;
          nextBaselines[result.targetIndex] = result.generatedCode;
          nextPrompts[result.targetIndex] = promptText.trim();
          return;
        }

        failedTargets.push(
          `${result?.llmName || `LLM ${Number(result?.targetIndex) + 1}`}: ${result?.error || "Generation failed"}`
        );
      });

      setLlmCodes(nextCodes);
      setLlmGeneratedBaselines(nextBaselines);
      setLlmGeneratedPrompts(nextPrompts);

      if (failedTargets.length > 0) {
        setError(`Some LLM generations failed. ${failedTargets.join(" | ")}`);
      }
    } catch (err) {
      setError(err.message || "Failed to generate code from prompt.");
    } finally {
      setIsGeneratingFromPrompt(false);
    }
  };

  const getCodeItems = (isHumanVsLlm) => {
    if (isHumanVsLlm) {
      return [
        {
          codeKey: "human",
          label: "Human",
          code: humanCode,
          isLlm: false,
        },
        ...llmCodes.map((code, index) => ({
          codeKey: `llm-${index}`,
          label: getLlmDisplayName(index),
          code,
          isLlm: true,
          llmIndex: index,
        })),
      ];
    }

    return llmCodes.map((code, index) => ({
      codeKey: `llm-${index}`,
      label: getLlmDisplayName(index),
      code,
      isLlm: true,
      llmIndex: index,
    }));
  };

  const getLanguageValidation = (items) => {
    const detections = items.map((item) => ({
      codeKey: item.codeKey,
      label: item.label,
      ...detectLanguage(item.code),
    }));

    const nonEmptyDetections = detections.filter((d) => d.language);
    if (nonEmptyDetections.length === 0) {
      return { isValid: false, message: "Could not detect language from the provided code snippets.", detections };
    }

    const uniqueLanguages = [...new Set(nonEmptyDetections.map((d) => d.language))];
    if (uniqueLanguages.length > 1) {
      const detail = detections
        .map((d) => `${d.label}: ${d.display}`)
        .join(", ");
      return {
        isValid: false,
        message: `All code samples must be in the same language. Detected -> ${detail}`,
        detections,
      };
    }

    if (detections.some((d) => !d.language)) {
      return {
        isValid: false,
        message: "Language detection failed for one or more snippets. Please provide clearer code.",
        detections,
      };
    }

    return { isValid: true, language: detections[0].display, detections };
  };

  const handleAnalyze = async () => {
    if (isCompletedComparison) return;

    const isHumanVsLlm = comparison?.type === "Human vs LLM";

    if (isHumanVsLlm && !humanCode.trim()) {
      alert("Please provide the human-written code sample.");
      return;
    }

    if (llmCodes.some((code) => !code.trim())) {
      alert("Please provide code for all LLM fields.");
      return;
    }

    const unselectedLLMs = llmCodes
      .map((_, idx) => idx)
      .filter((idx) => !llmNames[idx]);

    if (unselectedLLMs.length > 0) {
      alert(
        `Please select or specify an LLM for the following fields: ${unselectedLLMs
          .map((idx) => `LLM ${idx + 1}`)
          .join(", ")}`
      );
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      setResults(null);
      setRawAnalyzerResponses({});

      const analyzers = [];
      if (selectedAnalyses.bandit) analyzers.push({ name: "bandit", fn: analyzeBandit });
      if (selectedAnalyses.semgrep) analyzers.push({ name: "semgrep", fn: analyzeSemgrep });
      if (selectedAnalyses.sonar) analyzers.push({ name: "sonar", fn: analyzeCode });

      const analyzeAiServerWithLogging = async (code, languageKey, filename) => {
        const response = await analyzeAiServer(code, languageKey, "", filename);
        return response;
      };

      if (selectedAnalyses.aiServer) analyzers.push({ name: "aiServer", fn: analyzeAiServerWithLogging });

      if (analyzers.length === 0) {
        alert("Please select at least one analyzer.");
        return;
      }

      const codeItems = getCodeItems(isHumanVsLlm);
      const languageValidation = getLanguageValidation(codeItems);
      if (!languageValidation.isValid) {
        alert(languageValidation.message);
        return;
      }

      const detectedLanguageKey = languageValidation.detections?.[0]?.language || "javascript";

      const rawByCode = {};
      const resultItems = [];

      for (const codeItem of codeItems) {
        const settled = await Promise.allSettled(
          analyzers.map((a) =>
            a.name === "aiServer"
              ? a.fn(codeItem.code, detectedLanguageKey, `${codeItem.codeKey}.js`)
              : a.fn(codeItem.code, codeItem.code, detectedLanguageKey)
          )
        );

        const analyzerPayloads = {
          bandit: null,
          semgrep: null,
          sonar: null,
          aiServer: null,
        };

        analyzers.forEach((a, i) => {
          const runResult = settled[i];
          if (runResult.status === "fulfilled") {
            const responsePayload = runResult.value;
            analyzerPayloads[a.name] = a.name === "aiServer" ? responsePayload?.data || null : responsePayload?.human || responsePayload?.llm || null;
          }
        });

        rawByCode[codeItem.codeKey] = {
          codeKey: codeItem.codeKey,
          label: codeItem.label,
          analyzers: analyzerPayloads,
          vulnerabilities: [],
        };

        resultItems.push({
          codeKey: codeItem.codeKey,
          label: codeItem.label,
        });
      }

      setResults(resultItems);
      setRawAnalyzerResponses(rawByCode);

      const token = await getToken();
      const llmSamplesPayload = llmCodes.map((code, index) => ({
        llmName: llmNames[index],
        codeContent: code,
        generatedBaselineCode: llmGeneratedBaselines[index],
        generatedPromptText: llmGeneratedPrompts[index],
      }));

      const saveRes = await fetch(
        `${BACKEND_URL}/projects/${projectId}/comparisons/${comparisonId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            humanCode: isHumanVsLlm ? humanCode : null,
            llmSamples: llmSamplesPayload,
            rawAnalyzerResponses: rawByCode,
            detectedLanguageName: languageValidation.language,
          }),
        }
      );

      if (!saveRes.ok) {
        const saveErr = await saveRes.json().catch(() => ({}));
        throw new Error(saveErr.error || "Analysis finished but failed to save comparison data");
      }

      const saveData = await saveRes.json().catch(() => ({}));
      const vulnerabilitiesByCode =
        saveData && typeof saveData.vulnerabilitiesByCode === "object"
          ? saveData.vulnerabilitiesByCode
          : {};

      for (const [codeKey, vulnerabilities] of Object.entries(vulnerabilitiesByCode)) {
        if (!rawByCode[codeKey]) continue;
        rawByCode[codeKey].vulnerabilities = Array.isArray(vulnerabilities) ? vulnerabilities : [];
      }

      setRawAnalyzerResponses({ ...rawByCode });

      setComparison((prev) =>
        prev
          ? {
              ...prev,
              status: "Completed",
              completedAt: new Date().toISOString(),
            }
          : prev
      );
    } catch (err) {
      setError(err.message || "Unexpected error during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    if (isCompletedComparison) return;

    setHumanCode("");
    const newCodes = comparison?.type === "LLM vs LLM" ? ["", ""] : [""];
    setLlmCodes(newCodes);
    setLlmNames(newCodes.map(() => ""));
    setLlmCustomNames(newCodes.map(() => ""));
    setLlmGeneratedBaselines(newCodes.map(() => null));
    setLlmGeneratedPrompts(newCodes.map(() => null));
    setResults(null);
    setRawAnalyzerResponses({});
    setError(null);
    setPromptText("");
    setSelectedPromptTargets([]);
    setSelectedAnalyses({ bandit: true, semgrep: false, sonar: false, aiServer: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !comparison) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push(`/projects/${projectId}`)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </div>
    );
  }

  const isHumanVsLlm = comparison.type === "Human vs LLM";
  const isCompletedComparison = (comparison?.status || "").toLowerCase() === "completed";
  const hasAnyRawResults = Object.keys(rawAnalyzerResponses || {}).length > 0;
  const codeItems = getCodeItems(isHumanVsLlm);
  const languageValidation = getLanguageValidation(codeItems);
  const configuredLlmCards = getConfiguredLlmCards();
  const alteredGeneratedCards = configuredLlmCards.filter(
    (card) => getLlmBenchmarkState(card.index).isAltered
  );

  const openRawModal = (codeKey) => {
    setRawResultsModalState({
      isOpen: true,
      codeKey,
    });
  };

  const activeCodeEntry = rawResultsModalState.codeKey
    ? rawAnalyzerResponses?.[rawResultsModalState.codeKey]
    : null;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/${projectId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{comparison.name || "Untitled Comparison"}</h1>
              <p className="text-sm text-muted-foreground">Type: {comparison.type}</p>
            </div>
          </div>
        </div>

        {/* <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
            Enter each code sample in horizontal cards. Add LLMs to the right and scroll sideways when needed.
          </AlertDescription>
        </Alert> */}

        {!isCompletedComparison && (
          <Alert className={languageValidation.isValid ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}>
            <AlertCircle className={languageValidation.isValid ? "h-4 w-4 text-green-600" : "h-4 w-4 text-amber-600"} />
            <AlertDescription className={languageValidation.isValid ? "text-sm text-green-700 dark:text-green-300" : "text-sm text-amber-700 dark:text-amber-300"}>
              {languageValidation.isValid
                ? `Detected language: ${languageValidation.language}. Analysis is allowed.`
                : languageValidation.message}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {!isCompletedComparison && alteredGeneratedCards.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
              Modifying generated code makes it ineligible for benchmarking. Altered cards: {alteredGeneratedCards
                .map((card) => card.label)
                .join(", ")}
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-start gap-4">
            {codeItems.map((item) => {
              const canRemove =
                item.isLlm &&
                ((isHumanVsLlm && llmCodes.length > 1) || (!isHumanVsLlm && llmCodes.length > 2));

              return (
                <div key={item.codeKey} className="w-[420px] shrink-0 space-y-3 rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{item.label}</h3>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {detectLanguage(item.code).display}
                    </span>
                    {canRemove && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeLlmField(item.llmIndex)}
                        disabled={isAnalyzing || isCompletedComparison}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <CodeInputCard
                    title={item.isLlm ? "LLM Code" : "Human Code"}
                    icon={item.isLlm ? "llm" : "human"}
                    value={item.code}
                    setValue={(val) => {
                      if (item.isLlm) updateLlmCode(item.llmIndex, val);
                      else setHumanCode(val);
                    }}
                    disabled={isAnalyzing || isCompletedComparison}
                  />

                  {item.isLlm && (
                    <LLMSelector
                      selectedLLM={llmNames[item.llmIndex]}
                      customLLMName={llmCustomNames[item.llmIndex]}
                      onSelect={(name) => updateLlmName(item.llmIndex, name)}
                      onCustomChange={(name) => updateLlmCustomName(item.llmIndex, name)}
                      disabled={isAnalyzing || isCompletedComparison}
                      label={`${item.label} Model`}
                    />
                  )}

                  {item.isLlm && getLlmBenchmarkState(item.llmIndex).hasGeneratedBaseline && (
                    <div
                      className={`rounded-md border px-2 py-1 text-xs ${
                        getLlmBenchmarkState(item.llmIndex).isOriginal
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {getLlmBenchmarkState(item.llmIndex).isOriginal
                        ? "Using original generated code (benchmark eligible)."
                        : "Code was modified after generation (benchmark ineligible)."}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="w-[260px] shrink-0 rounded-xl border border-dashed bg-card p-3">
              <Button
                variant="outline"
                className="h-full w-full border-dashed"
                onClick={addLlmField}
                disabled={isAnalyzing || isCompletedComparison}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another LLM
              </Button>
            </div>
          </div>
        </div>

        {!isCompletedComparison && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Generate LLM Code From Prompt</h3>
              {/* <p className="text-sm text-muted-foreground">
                Select one or more LLM cards and generate code from a single prompt.
              </p> */}
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm-generation-prompt">Prompt</Label>
              <Textarea
                id="llm-generation-prompt"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe what code should be generated..."
                disabled={isGeneratingFromPrompt || isAnalyzing}
                className="min-h-28"
              />
            </div>

            <div className="space-y-2">
              {/* <Label>Select LLM Targets</Label> */}
              <div className="grid gap-2 md:grid-cols-2">
                {configuredLlmCards.map((card) => (
                  <Label
                    key={card.index}
                    htmlFor={`prompt-target-${card.index}`}
                    className="hover:bg-accent/40 flex items-start gap-3 rounded-lg border p-3 cursor-pointer"
                  >
                    <Checkbox
                      id={`prompt-target-${card.index}`}
                      checked={selectedPromptTargets.includes(card.index)}
                      onCheckedChange={() => togglePromptTarget(card.index)}
                      disabled={isGeneratingFromPrompt || isAnalyzing}
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{card.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {card.provider || "No provider"}
                        {card.modelIdentifier ? ` • ${card.modelIdentifier}` : " • No model"}
                      </div>
                    </div>
                  </Label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGenerateFromPrompt}
                disabled={isGeneratingFromPrompt || isAnalyzing || configuredLlmCards.length === 0}
              >
                {isGeneratingFromPrompt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate For Selected LLMs
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 bg-card border rounded-xl p-4">
          <h4 className="font-semibold mb-3">Select Analyses:</h4>
          <div className="flex flex-wrap gap-4">
            {["bandit", "semgrep", "sonar", "aiServer"].map((key) => (
              <Label
                key={key}
                htmlFor={key}
                className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border p-3 cursor-pointer
                  has-[[aria-checked=true]]:border-primary
                  has-[[aria-checked=true]]:bg-primary/5"
              >
                <Checkbox
                  id={key}
                  checked={selectedAnalyses[key]}
                  onCheckedChange={(checked) => handleToggleAnalysis(key, checked)}
                  disabled={isAnalyzing || isCompletedComparison}
                />
                <span className="font-medium capitalize">{key}</span>
              </Label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 py-4 justify-end">
          <Button variant="outline" onClick={handleClear} disabled={isAnalyzing || isCompletedComparison}>
            Clear
          </Button>
          <Button onClick={handleAnalyze} disabled={isAnalyzing || isCompletedComparison || !languageValidation.isValid} size="lg">
            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCompletedComparison ? "Completed" : isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>

        {results && results.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold">Analysis Results</h2>

            {/* <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-slate-700 dark:text-slate-300">
                Results are code-wise. Open a code card to view all selected analyzers in one raw output modal.
              </AlertDescription>
            </Alert> */}

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-stretch gap-4">
                {results.map((resultItem) => {
                  const codeResult = rawAnalyzerResponses?.[resultItem.codeKey];
                  const availableAnalyzers = Object.entries(codeResult?.analyzers || {})
                    .filter(([, payload]) => Boolean(payload))
                    .map(([name]) =>
                      name === "aiServer" ? "AI Server" : name.charAt(0).toUpperCase() + name.slice(1)
                    );

                  return (
                    <div key={resultItem.codeKey} className="w-[320px] shrink-0 rounded-xl border bg-card p-4 space-y-3">
                      <h3 className="font-semibold">{resultItem.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {availableAnalyzers.length > 0
                          ? `Available raw outputs: ${availableAnalyzers.join(", ")}`
                          : "No raw output available"}
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => openRawModal(resultItem.codeKey)}
                        disabled={!hasAnyRawResults || availableAnalyzers.length === 0}
                      >
                        View All Raw Outputs
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <ComparisonWinner results={results} rawAnalyzerResponses={rawAnalyzerResponses} />
          </div>
        )}

        <AnalyzerRawModal
          isOpen={rawResultsModalState.isOpen}
          onClose={() => setRawResultsModalState((prev) => ({ ...prev, isOpen: false }))}
          codeEntry={activeCodeEntry}
        />
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button type="button" size="icon" aria-label="Open chat" onClick={() => setIsChatOpen(true)}>
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>

      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="border-b">
            <SheetTitle>AI Chat</SheetTitle>
            <SheetDescription>
              Ask follow-up questions about this comparison.
            </SheetDescription>
          </SheetHeader>

          <div className="flex h-[calc(100%-86px)] flex-col">
            <div ref={chatContainerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {chatLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading chat history...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No messages yet. Start the conversation with the AI assistant.
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isUser = String(msg.type || "").toLowerCase() === "user";
                  return (
                    <div
                      key={msg.messageId || `${msg.type}-${idx}`}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
<div
  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm overflow-x-auto ${
    isUser
      ? "bg-primary text-primary-foreground whitespace-pre-wrap"
      : "bg-muted text-foreground"
  }`}
>
  {isUser ? (
    msg.messageText
  ) : (
    /* Moved the className to a wrapper div here */
    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>ol]:list-decimal [&>ol]:pl-4 [&>ul]:list-disc [&>ul]:pl-4[&>li]:mb-1">
      <ReactMarkdown>
        {msg.messageText}
      </ReactMarkdown>
    </div>
  )}
</div>
                    </div>
                  );
                })
              )}
            </div>

            {chatError && (
              <div className="px-4 pb-2 text-sm text-red-600">{chatError}</div>
            )}

            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={chatSending || chatLoading}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSendChatMessage}
                  disabled={chatSending || chatLoading || !chatInput.trim()}
                  aria-label="Send message"
                >
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
