"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ExternalLink, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChatConfig {
  enabled: boolean;
  bot_name: string;
  welcome_message: string;
}

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
}

interface ParsedPart {
  type: "text" | "article";
  content?: string;
  slug?: string;
  title?: string;
}

function parseResponse(text: string): { parts: ParsedPart[]; navigateSlug?: string } {
  const parts: ParsedPart[] = [];
  let navigateSlug: string | undefined;

  const navMatch = text.match(/\[NAVIGATE:([^\]]+)\]/);
  if (navMatch) {
    navigateSlug = navMatch[1];
    text = text.replace(/\[NAVIGATE:[^\]]+\]/g, "").trim();
  }

  // Match both [ARTICLE:slug:Title] and [ARTICLE:slug] formats
  const regex = /\[ARTICLE:([^\]:]+)(?::([^\]]+))?\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index).trim();
      if (chunk) parts.push({ type: "text", content: chunk });
    }
    const slug = match[1].trim();
    // If no title, format slug: remove trailing hash (e.g. -u24cz), replace hyphens with spaces
    const rawTitle = match[2]
      ? match[2].trim()
      : slug.replace(/-[a-z0-9]{4,6}$/, "").replace(/-/g, " ");
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    parts.push({ type: "article", slug, title });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) parts.push({ type: "text", content: remaining });

  return { parts, navigateSlug };
}

function BotMessage({ text, onNavigate }: { text: string; onNavigate: (slug: string) => void }) {
  const { parts, navigateSlug } = parseResponse(text);

  useEffect(() => {
    if (navigateSlug) {
      const timer = setTimeout(() => onNavigate(navigateSlug!), 900);
      return () => clearTimeout(timer);
    }
  }, [navigateSlug, onNavigate]);

  return (
    <div className="flex flex-col gap-2.5">
      {parts.map((part, i) => {
        if (part.type === "text" && part.content) {
          return (
            <p key={i} className="text-[13px] leading-[1.6] whitespace-pre-wrap">
              {part.content}
            </p>
          );
        }
        if (part.type === "article" && part.slug && part.title) {
          return (
            <Link
              key={i}
              href={`/clanok/${part.slug}`}
              className="aiwai-chip inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all self-start group"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
              {part.title}
            </Link>
          );
        }
        return null;
      })}
      {navigateSlug && (
        <p className="text-[10px] opacity-40 font-semibold italic animate-pulse">
          Presmerovávam...
        </p>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] py-0.5 px-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="aiwai-typing-dot w-[7px] h-[7px] rounded-full aiwai-dot"
        />
      ))}
    </div>
  );
}

/* Small avatar circle with initials */
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.charAt(0).toUpperCase();
  const cls = size === "sm"
    ? "w-7 h-7 text-[11px]"
    : "w-10 h-10 text-[13px]";
  return (
    <div className={`${cls} rounded-full aiwai-avatar flex items-center justify-center font-black flex-shrink-0`}>
      {initial}
    </div>
  );
}

export function ChatbotWidget() {
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [btnPulse, setBtnPulse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = isRendered;

  const articleSlug = pathname?.startsWith("/clanok/")
    ? pathname.replace("/clanok/", "").replace(/\/$/, "")
    : undefined;

  useEffect(() => {
    supabase
      .from("chatbot_config")
      .select("enabled, bot_name, welcome_message")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setConfig(data as ChatConfig);
          setTimeout(() => setBtnPulse(true), 4000);
          setTimeout(() => setBtnPulse(false), 7500);
        }
      });
  }, []);

  useEffect(() => {
    if (isRendered && config && messages.length === 0) {
      setMessages([{ id: "welcome", role: "bot", text: config.welcome_message }]);
    }
  }, [isRendered, config, messages.length]);

  useEffect(() => {
    if (isVisible) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isVisible]);

  useEffect(() => {
    if (isVisible) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isVisible]);

  const openChat = useCallback(() => {
    setIsRendered(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsVisible(true)));
    setBtnPulse(false);
  }, []);

  const closeChat = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => setIsRendered(false), 300);
  }, []);

  const handleNavigate = useCallback(
    (slug: string) => {
      router.push(`/clanok/${slug}`);
      closeChat();
    },
    [router, closeChat]
  );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Clean [ARTICLE:] and [NAVIGATE:] markers from bot messages in history
    // so Gemini doesn't get confused by its own previous output format
    const cleanBotText = (t: string) =>
      t.replace(/\[ARTICLE:[^:]+:([^\]]+)\]/g, '"$1"')
       .replace(/\[NAVIGATE:[^\]]+\]/g, "")
       .replace(/\s{2,}/g, " ")
       .trim();

    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role,
        text: m.role === "bot" ? cleanBotText(m.text) : m.text,
      }));

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, articleSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba servera");
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + "_bot", role: "bot", text: data.result },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + "_err", role: "bot", text: "Nastala chyba. Skúste znova." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!config || !config.enabled) return null;
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <style>{`
        /* ── theme tokens ── */
        :root {
          --cw-bg:        #ffffff;
          --cw-bg2:       #f5f5f5;
          --cw-border:    rgba(0,0,0,0.09);
          --cw-text:      #0a0a0a;
          --cw-muted:     rgba(0,0,0,0.38);
          --cw-user-bg:   #0a0a0a;
          --cw-user-fg:   #ffffff;
          --cw-bot-bg:    #f0f0f0;
          --cw-bot-fg:    #0a0a0a;
          --cw-input-bg:  #f5f5f5;
          --cw-send-bg:   #0a0a0a;
          --cw-send-fg:   #ffffff;
          --cw-avatar-bg: #0a0a0a;
          --cw-avatar-fg: #ffffff;
          --cw-chip-bg:   rgba(0,0,0,0.07);
          --cw-chip-fg:   rgba(0,0,0,0.7);
          --cw-chip-border: rgba(0,0,0,0.1);
          --cw-dot-bg:    rgba(0,0,0,0.3);
          --cw-shadow:    0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08);
          --cw-btn-bg:    #0a0a0a;
          --cw-btn-fg:    #ffffff;
          --cw-pulse-bg:  #0a0a0a;
        }
        .dark {
          --cw-bg:        #141414;
          --cw-bg2:       #1c1c1c;
          --cw-border:    rgba(255,255,255,0.08);
          --cw-text:      #f0f0f0;
          --cw-muted:     rgba(255,255,255,0.35);
          --cw-user-bg:   #ffffff;
          --cw-user-fg:   #0a0a0a;
          --cw-bot-bg:    #222222;
          --cw-bot-fg:    #f0f0f0;
          --cw-input-bg:  #1e1e1e;
          --cw-send-bg:   #ffffff;
          --cw-send-fg:   #0a0a0a;
          --cw-avatar-bg: #ffffff;
          --cw-avatar-fg: #0a0a0a;
          --cw-chip-bg:   rgba(255,255,255,0.07);
          --cw-chip-fg:   rgba(255,255,255,0.7);
          --cw-chip-border: rgba(255,255,255,0.1);
          --cw-dot-bg:    rgba(255,255,255,0.3);
          --cw-shadow:    0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
          --cw-btn-bg:    #ffffff;
          --cw-btn-fg:    #0a0a0a;
          --cw-pulse-bg:  #ffffff;
        }

        /* ── component classes ── */
        .aiwai-panel {
          background: var(--cw-bg);
          color: var(--cw-text);
          border: 1px solid var(--cw-border);
          box-shadow: var(--cw-shadow);
        }
        .aiwai-header-border { border-bottom: 1px solid var(--cw-border); }
        .aiwai-avatar {
          background: var(--cw-avatar-bg);
          color: var(--cw-avatar-fg);
        }
        .aiwai-muted { color: var(--cw-muted); }
        .aiwai-user-bubble {
          background: var(--cw-user-bg);
          color: var(--cw-user-fg);
        }
        .aiwai-bot-bubble {
          background: var(--cw-bot-bg);
          color: var(--cw-bot-fg);
        }
        .aiwai-input {
          background: var(--cw-input-bg);
          color: var(--cw-text);
          border: 1px solid var(--cw-border);
        }
        .aiwai-input::placeholder { color: var(--cw-muted); }
        .aiwai-input:focus { outline: none; border-color: var(--cw-text); }
        .aiwai-send {
          background: var(--cw-send-bg);
          color: var(--cw-send-fg);
        }
        .aiwai-chip {
          background: var(--cw-chip-bg);
          color: var(--cw-chip-fg);
          border: 1px solid var(--cw-chip-border);
        }
        .aiwai-chip:hover { opacity: 0.8; }
        .aiwai-dot { background: var(--cw-dot-bg); }
        .aiwai-btn {
          background: var(--cw-btn-bg);
          color: var(--cw-btn-fg);
        }
        .aiwai-input-area { border-top: 1px solid var(--cw-border); }

        /* ── hide scrollbar (cross-browser incl. Safari/WebKit) ── */
        .aiwai-messages-scroll::-webkit-scrollbar { display: none; }
        .aiwai-messages-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        /* ── GPU acceleration + panel open/close animations ── */
        .aiwai-panel {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          will-change: transform, opacity;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .aiwai-panel-in {
          -webkit-animation: cwIn 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards;
          animation: cwIn 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards;
        }
        .aiwai-panel-out {
          -webkit-animation: cwOut 0.24s ease-in forwards;
          animation: cwOut 0.24s ease-in forwards;
        }
        .aiwai-pulse {
          -webkit-animation: pulseRing 1.5s ease-out infinite;
          animation: pulseRing 1.5s ease-out infinite;
        }
        .aiwai-btn {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          will-change: transform;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        /* Use CSS classes for animations (avoids React inline style shorthand conflict) */
        .aiwai-msg-row {
          -webkit-animation: msgIn 0.22s ease forwards;
          animation: msgIn 0.22s ease forwards;
          will-change: transform, opacity;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .aiwai-typing-dot {
          -webkit-animation: typingDot 1.3s ease-in-out infinite;
          animation: typingDot 1.3s ease-in-out infinite;
        }
        .aiwai-typing-dot:nth-child(2) { -webkit-animation-delay: 0.18s; animation-delay: 0.18s; }
        .aiwai-typing-dot:nth-child(3) { -webkit-animation-delay: 0.36s; animation-delay: 0.36s; }

        /* ── animations ── */
        @-webkit-keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; -webkit-transform: translateY(0); transform: translateY(0); }
          30% { opacity: 1; -webkit-transform: translateY(-3px); transform: translateY(-3px); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @-webkit-keyframes cwIn {
          from { opacity: 0; -webkit-transform: translateY(18px) scale(0.95); transform: translateY(18px) scale(0.95); }
          to   { opacity: 1; -webkit-transform: translateY(0) scale(1); transform: translateY(0) scale(1); }
        }
        @keyframes cwIn {
          from { opacity: 0; transform: translateY(18px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @-webkit-keyframes cwOut {
          from { opacity: 1; -webkit-transform: translateY(0) scale(1); transform: translateY(0) scale(1); }
          to   { opacity: 0; -webkit-transform: translateY(18px) scale(0.95); transform: translateY(18px) scale(0.95); }
        }
        @keyframes cwOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(18px) scale(0.95); }
        }
        @-webkit-keyframes msgIn {
          from { opacity: 0; -webkit-transform: translateY(6px); transform: translateY(6px); }
          to   { opacity: 1; -webkit-transform: translateY(0); transform: translateY(0); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @-webkit-keyframes pulseRing {
          0%   { -webkit-transform: scale(1);    transform: scale(1);    opacity: 0.45; }
          100% { -webkit-transform: scale(1.85); transform: scale(1.85); opacity: 0; }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.45; }
          100% { transform: scale(1.85); opacity: 0; }
        }
      `}</style>

      {/* ── Chat panel ── */}
      {isRendered && (
        <div
          className={`aiwai-panel ${isVisible ? "aiwai-panel-in" : "aiwai-panel-out"} fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] flex flex-col rounded-3xl overflow-hidden`}
          style={{ maxHeight: "min(540px, calc(100vh - 120px))", transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="aiwai-header-border flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <Avatar name={config.bot_name} size="md" />
                {/* Online indicator */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2"
                  style={{ borderColor: "var(--cw-bg)" }}
                />
              </div>
              <div>
                <p className="text-[14px] font-black tracking-tight">{config.bot_name}</p>
                <p className="aiwai-muted text-[11px] font-semibold mt-0.5">
                  Online · Odpovedá okamžite
                </p>
              </div>
            </div>
            <button
              onClick={closeChat}
              className="aiwai-muted w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-all hover:scale-105 active:scale-95"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Quick suggestions (show only before first user message) */}
          {messages.filter((m) => m.role === "user").length === 0 && (
            <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
              {["Čo je nové?", "Najčítanejšie články", "Odporuč niečo o AI"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="aiwai-chip text-[11px] font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-70 active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="aiwai-messages-scroll flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3.5 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`aiwai-msg-row flex gap-2.5 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.role === "bot" && (
                  <Avatar name={config.bot_name} size="sm" />
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "aiwai-user-bubble rounded-br-md"
                      : "aiwai-bot-bubble rounded-bl-md"
                  }`}
                >
                  {msg.role === "bot" ? (
                    <BotMessage text={msg.text} onNavigate={handleNavigate} />
                  ) : (
                    <p className="text-[13px] leading-[1.6]">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="aiwai-msg-row flex gap-2.5 items-end">
                <Avatar name={config.bot_name} size="sm" />
                <div className="aiwai-bot-bubble rounded-2xl rounded-bl-md px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="aiwai-input-area px-4 pb-5 pt-3">
            <div className="flex items-center gap-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Napíš správu..."
                disabled={loading}
                className="aiwai-input flex-1 rounded-2xl px-4 py-2.5 text-[13px] transition-all disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="aiwai-send w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:opacity-80 active:scale-90 disabled:opacity-25 disabled:pointer-events-none flex-shrink-0"
              >
                <Send className="w-[15px] h-[15px]" />
              </button>
            </div>
            <p className="aiwai-muted text-[9px] font-semibold text-center mt-3 tracking-wide opacity-50">
              AIWai · Vždy skontroluj výsledky
            </p>
          </div>
        </div>
      )}

      {/* ── Toggle button ── */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-50">
        {btnPulse && !isOpen && (
          <span
            className="aiwai-pulse absolute inset-0 rounded-full"
            style={{ background: "var(--cw-pulse-bg)" }}
          />
        )}
        <button
          onClick={isOpen ? closeChat : openChat}
          className="aiwai-btn relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }}
          aria-label={isOpen ? "Zavrieť chat" : "Otvoriť chat"}
        >
          <span
            className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-250"
            style={{
              opacity: isOpen ? 0 : 1,
              transform: isOpen ? "scale(0.6) rotate(20deg)" : "scale(1) rotate(0deg)",
            }}
          >
            <MessageCircle className="w-6 h-6" />
          </span>
          <span
            className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-250"
            style={{
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? "scale(1) rotate(0deg)" : "scale(0.6) rotate(-20deg)",
            }}
          >
            <X className="w-5 h-5" />
          </span>
        </button>
      </div>
    </>
  );
}
