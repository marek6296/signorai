"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Bot, Save, Loader2, CheckCircle, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";

interface ChatbotConfig {
  enabled: boolean;
  bot_name: string;
  welcome_message: string;
}

const DEFAULT_CONFIG: ChatbotConfig = {
  enabled: true,
  bot_name: "AIWai Asistent",
  welcome_message:
    "Ahoj! Som AIWai Asistent. Môžem ti pomôcť nájsť články, odpovedať na otázky o AI a technológiách alebo ťa nasmerovať na správny obsah. Čo ťa zaujíma?",
};

export default function AdminChatbotPage() {
  const [config, setConfig] = useState<ChatbotConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    supabase
      .from("chatbot_config")
      .select("enabled, bot_name, welcome_message")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as ChatbotConfig);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");

    const { error } = await supabase.from("chatbot_config").upsert(
      { id: 1, ...config, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

    setSaving(false);
    setStatus(error ? "error" : "success");
    if (status !== "idle") setTimeout(() => setStatus("idle"), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Bot className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Chatbot</h1>
            <p className="text-xs text-amber-400/60 font-bold tracking-wider mt-0.5">
              NASTAVENIA AI ASISTENTA
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enabled toggle */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Chatbot aktívny</p>
                <p className="text-xs text-gray-400 mt-1">
                  Zobraziť tlačidlo chatbota na stránke pre návštevníkov
                </p>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                {config.enabled ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10 opacity-40" />
                )}
              </button>
            </div>
          </div>

          {/* Bot name */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400/70">
              Meno asistenta
            </label>
            <input
              type="text"
              value={config.bot_name}
              onChange={(e) => setConfig((c) => ({ ...c, bot_name: e.target.value }))}
              maxLength={60}
              placeholder="napr. AIWai Asistent"
              className="w-full rounded-xl px-4 py-3 text-sm bg-gray-800/60 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
            />
          </div>

          {/* Welcome message */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-amber-400/70">
              Uvítacia správa
            </label>
            <textarea
              value={config.welcome_message}
              onChange={(e) => setConfig((c) => ({ ...c, welcome_message: e.target.value }))}
              rows={4}
              maxLength={400}
              placeholder="Správa, ktorú chatbot zobrazí pri otvorení..."
              className="w-full resize-none rounded-xl px-4 py-3 text-sm bg-gray-800/60 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
            />
            <p className="text-xs text-gray-500 text-right">
              {config.welcome_message.length} / 400
            </p>
          </div>

          {/* Info box */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <p className="text-xs text-amber-300/70 font-semibold leading-relaxed">
              Chatbot automaticky načítava posledných 30 článkov ako kontext. Vie odpovedať na
              otázky o obsahu portálu, odporučiť články a nasmerovať návštevníka na správnu stránku.
              Poháňaný Gemini 2.0 Flash.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ukladám...
              </>
            ) : status === "success" ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Uložené!
              </>
            ) : status === "error" ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Chyba pri ukladaní
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Uložiť nastavenia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
