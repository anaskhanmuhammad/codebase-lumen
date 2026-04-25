'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function LLMSelector({
  selectedLLM,
  onSelect,
  onCustomChange,
  customLLMName,
  disabled = false,
  label = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableLlms, setAvailableLlms] = useState([]);
  const [loadingLlms, setLoadingLlms] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isCustom, setIsCustom] = useState(
    Boolean(selectedLLM)
  );

  useEffect(() => {
    const fetchLlms = async () => {
      try {
        setLoadingLlms(true);
        setLoadError('');

        const res = await fetch(`${BACKEND_URL}/projects/llms`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load LLMs');
        }

        const data = await res.json();
        setAvailableLlms(Array.isArray(data.llms) ? data.llms : []);
      } catch (error) {
        setLoadError(error.message || 'Failed to load LLMs');
        setAvailableLlms([]);
      } finally {
        setLoadingLlms(false);
      }
    };

    fetchLlms();
  }, []);

  useEffect(() => {
    if (!selectedLLM) {
      setIsCustom(false);
      return;
    }

    const isKnownModel = availableLlms.some((llm) => llm.llmName === selectedLLM);
    setIsCustom(!isKnownModel);
  }, [selectedLLM, availableLlms]);

  const handleSelectLLM = (llm) => {
    onSelect(llm);
    setIsCustom(false);
    setIsOpen(false);
  };

  const handleCustomSelect = () => {
    setIsCustom(true);
    onSelect('custom');
    setIsOpen(false);
  };

  const handleCustomInputChange = (value) => {
    onCustomChange(value);
    onSelect(value);
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background text-left text-sm flex items-center justify-between hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="truncate">
            {loadingLlms
              ? 'Loading LLMs...'
              : isCustom && customLLMName
                ? customLLMName
                : (selectedLLM || 'Select an LLM')}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-md z-50 max-h-60 overflow-y-auto">
            {availableLlms.length > 0 ? availableLlms.map((llm) => (
              <button
                key={llm.llmId}
                onClick={() => handleSelectLLM(llm.llmName)}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-primary opacity-0" />
                <span className="flex flex-col items-start">
                  <span>{llm.llmName}</span>
                  {(llm.provider || llm.modelIdentifier) && (
                    <span className="text-xs text-muted-foreground">
                      {[llm.provider, llm.modelIdentifier].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </span>
              </button>
            )) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {loadError || 'No LLMs available'}
              </div>
            )}

            <div className="border-t border-input my-1" />

            <button
              onClick={handleCustomSelect}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm font-medium text-primary"
            >
              + Custom LLM
            </button>
          </div>
        )}
      </div>

      {isCustom && (
        <Input
          type="text"
          placeholder="Enter custom LLM name"
          value={customLLMName}
          onChange={(e) => handleCustomInputChange(e.target.value)}
          disabled={disabled}
          className="mt-2"
        />
      )}

      {!selectedLLM && (
        <p className="text-xs text-destructive">LLM selection required</p>
      )}
    </div>
  );
}
