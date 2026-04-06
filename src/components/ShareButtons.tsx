"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mb-8 bg-secondary/20 border border-border/50 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 mr-1">
          <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Zdieľať:
          </span>
        </div>

        {/* Facebook */}
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: "rgba(24, 119, 242, 0.15)",
            border: "1px solid rgba(24, 119, 242, 0.3)",
            color: "#4a9af5",
          }}
          aria-label="Zdieľať na Facebooku"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Facebook
        </a>

        {/* X / Twitter */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "rgba(255,255,255,0.85)",
          }}
          aria-label="Zdieľať na X / Twitter"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X / Twitter
        </a>

        {/* Copy Link */}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: copied ? "rgba(34, 197, 94, 0.15)" : "rgba(255,255,255,0.06)",
            border: copied ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(255,255,255,0.12)",
            color: copied ? "#4ade80" : "rgba(255,255,255,0.6)",
          }}
          aria-label="Kopírovať odkaz"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Skopírované!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Kopírovať odkaz
            </>
          )}
        </button>
      </div>
    </div>
  );
}
