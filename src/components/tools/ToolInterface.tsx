"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, RotateCcw } from "lucide-react";
import type { AiTool } from "@/lib/ai-tools-config";

interface ToolInterfaceProps {
  tool: AiTool;
}

export function ToolInterface({ tool }: ToolInterfaceProps) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    tool.options?.forEach((opt) => { defaults[opt.key] = opt.values[0]?.value ?? ""; });
    return defaults;
  });
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.slug, input: input.trim(), options }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba servera");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala neočakávaná chyba.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInput("");
    setResult("");
    setError("");
  };

  const charPercent = Math.min((input.length / tool.maxInputLength) * 100, 100);
  const isNearLimit = input.length > tool.maxInputLength * 0.85;

  return (
    <div className="flex flex-col gap-5">
      {/* Options */}
      {tool.options && tool.options.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {tool.options.map((opt) => (
            <div key={opt.key} className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {opt.label}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {opt.values.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setOptions((prev) => ({ ...prev, [opt.key]: v.value }))}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={
                      options[opt.key] === v.value
                        ? {
                            background: `${tool.color}20`,
                            border: `1px solid ${tool.color}50`,
                            color: tool.color,
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.5)",
                          }
                    }
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {tool.inputLabel}
          </label>
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: isNearLimit ? "#f87171" : "rgba(255,255,255,0.3)" }}
          >
            {input.length} / {tool.maxInputLength}
          </span>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, tool.maxInputLength))}
          placeholder={tool.inputPlaceholder}
          rows={6}
          disabled={loading}
          className="w-full resize-none rounded-2xl px-4 py-3.5 text-sm font-medium bg-secondary/20 border border-border/50 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50"
        />
        {/* Progress bar */}
        <div className="h-0.5 rounded-full bg-border/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${charPercent}%`,
              background: isNearLimit ? "#f87171" : tool.color,
            }}
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!input.trim() || loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        style={{ background: tool.color, color: "#fff" }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generujem...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {tool.buttonLabel}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-semibold">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {tool.outputLabel}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-foreground/70 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                style={
                  copied
                    ? { background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Skopírované!" : "Kopírovať"}
              </button>
            </div>
          </div>
          <div className="relative rounded-2xl border border-border/40 bg-secondary/10 p-5">
            <pre className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
