"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Article } from "@/lib/data";
import Link from "next/link";
import { Edit, ArrowDown, Trash2, Sparkles, Plus, Globe, Search, CheckCircle2, XCircle, RefreshCw, Zap, History, RotateCcw, BarChart3, Users, Share2, Copy, Facebook, Instagram, Calendar, Clock, ChevronDown, ChevronUp, Smartphone, Monitor, Check, CloudLightning, ChevronRight, Image as ImageIcon, Bot, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArticleCard } from "@/components/ArticleCard";
import Image from "next/image";
import { InstagramPreview } from "@/components/InstagramPreview";
import { toBlob } from 'html-to-image';

const XIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

type SuggestedNews = {
    id: string;
    url: string;
    title: string;
    summary: string;
    source: string;
    category?: string;
    status: 'pending' | 'processed' | 'ignored';
    created_at: string;
};

type AutopilotHistoryItem = {
    title: string;
    url: string;
    category: string;
    created_at: string;
};

type AutopilotSettings = {
    enabled: boolean;
    last_run: string | null;
    processed_count: number;
};

type SocialBotSettings = {
    enabled: boolean;
    interval_hours: number;
    posting_times: string[];
    auto_publish: boolean;
    target_categories: string[];
    last_run?: string;
    last_status?: string;
    last_category_index?: number;
};

type SocialPost = {
    id: string;
    created_at?: string;
    article_id: string;
    platform: 'Instagram' | 'Facebook' | 'X';
    content: string;
    status: 'draft' | 'posted';
    posted_at?: string;
    articles?: {
        title: string;
        slug: string;
        category: string;
        main_image?: string;
        ai_summary?: string;
        published_at?: string;
    };
};

export default function AdminPage() {
    const [url, setUrl] = useState("");
    const [synthesisUrls, setSynthesisUrls] = useState<string[]>([""]);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [articles, setArticles] = useState<Article[]>([]);
    const [suggestions, setSuggestions] = useState<SuggestedNews[]>([]);
    const [loadingArticles, setLoadingArticles] = useState(true);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [autopilotSettings, setAutopilotSettings] = useState<AutopilotSettings>({ enabled: false, last_run: null, processed_count: 0 });
    const [analytics, setAnalytics] = useState<{
        totalVisits: number,
        uniqueVisitors: number,
        todayVisits: number,
        todayUnique: number,
        topPages: { path: string, count: number }[],
        countries: { name: string, count: number }[],
        devices: { name: string, count: number }[],
        browsers: { name: string, count: number }[],
        dailyStats: { date: string, visits: number, unique: number }[],
        recentVisits: {
            path: string,
            visitor_id: string,
            country: string,
            city: string,
            region: string,
            timezone: string,
            latitude: string,
            longitude: string,
            device: string,
            browser: string,
            os: string,
            created_at: string,
            user_agent: string,
            referrer: string | null
        }[],
        newsletterSubscribers: { email: string, updated_at: string }[]
    }>({
        totalVisits: 0,
        uniqueVisitors: 0,
        todayVisits: 0,
        todayUnique: 0,
        topPages: [],
        countries: [],
        devices: [],
        browsers: [],
        dailyStats: [],
        recentVisits: [],
        newsletterSubscribers: []
    });
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [isNewsletterOpen, setIsNewsletterOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Social Tab State
    const [socialSelectedArticles, setSocialSelectedArticles] = useState<string[]>([]);
    const [socialArticleSearch, setSocialArticleSearch] = useState("");
    const [socialPlatforms, setSocialPlatforms] = useState<("Facebook" | "Instagram" | "X")[]>([]);
    const [socialResults, setSocialResults] = useState<Record<string, Record<string, string>>>({});
    const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
    const [selectedPlannerArticle, setSelectedPlannerArticle] = useState<string | null>(null);
    const [selectedPostsForPublishing, setSelectedPostsForPublishing] = useState<string[]>([]);
    // socialStats removed due to being unused
    // const [socialStats, setSocialStats] = useState({ total_published: 0, pending_drafts: 0 });
    const [socialBotSettings, setSocialBotSettings] = useState<SocialBotSettings>({
        enabled: false,
        interval_hours: 12,
        posting_times: ["09:00", "18:00"],
        auto_publish: false,
        target_categories: ["AI", "Tech"]
    });
    const [countdownToNext, setCountdownToNext] = useState<string>("");
    const [countdownAutopilot, setCountdownAutopilot] = useState<string>("");
    const [isBotRunning, setIsBotRunning] = useState(false);
    const [isAutopilotManualRunning, setIsAutopilotManualRunning] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");

    // Modern Custom Bot (Manual Prompt)
    const [customBotPrompt, setCustomBotPrompt] = useState("");
    const [customBotPostSocial, setCustomBotPostSocial] = useState(true);
    const [customBotPublishStatus, setCustomBotPublishStatus] = useState<'published' | 'draft'>('published');
    const [isCustomBotRunning, setIsCustomBotRunning] = useState(false);

    // Tab control – obnovíme z localStorage pri refreshi (prvý zápis preskočíme, aby sme neprepísali obnovenú kartu)
    const [activeTab, setActiveTab] = useState<"create" | "manage" | "discovery" | "analytics" | "social" | "autopilot" | "full_automation">("manage");
    const skipNextSaveRef = useRef(true);
    useEffect(() => {
        setIsHydrated(true);
        if (typeof window === "undefined") return;
        const saved = localStorage.getItem("admin-active-tab");
        if (saved && ["create", "manage", "discovery", "analytics", "social", "autopilot", "full_automation"].includes(saved)) {
            setActiveTab(saved as typeof activeTab);
            skipNextSaveRef.current = true;
        }
    }, []);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }
        localStorage.setItem("admin-active-tab", activeTab);

        // Reset social platforms when entering the social tab
        if (activeTab === "social") {
            setSocialPlatforms([]);
        }
    }, [activeTab]);

    useEffect(() => {
        if (!socialBotSettings.enabled || !socialBotSettings.posting_times?.length) {
            setCountdownToNext("");
            return;
        }

        const triggerBotAutomation = async () => {
            if (isBotRunning) return;
            setIsBotRunning(true);
            try {
                // Call the bot API directly from the UI when timer hits zero
                const res = await fetch(`/api/admin/bot-full-automation?secret=${process.env.NEXT_PUBLIC_ADMIN_SECRET || 'make-com-webhook-secret'}&force=true`);
                const data = await res.json();
                console.log("Bot auto-triggered from UI:", data);
                await fetchAutopilotSettings();
            } catch (e: unknown) {
                console.error("Failed to auto-trigger bot:", e);
            } finally {
                setIsBotRunning(false);
            }
        };

        const updateCountdown = () => {
            const now = new Date();
            const bratislavaTimeStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Bratislava',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).format(now);

            const [currH, currM, currS] = bratislavaTimeStr.split(':').map(Number);
            const currTotalSeconds = currH * 3600 + currM * 60 + currS;

            const timesInSeconds = socialBotSettings.posting_times.map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 3600 + m * 60;
            }).sort((a, b) => a - b);

            let nextTimeInSeconds = timesInSeconds.find(t => t >= currTotalSeconds);
            if (nextTimeInSeconds === undefined) {
                nextTimeInSeconds = timesInSeconds[0] + 24 * 3600;
            }

            const diffSeconds = nextTimeInSeconds - currTotalSeconds;

            // Trigger when exactly at time
            if (diffSeconds === 0 && !isBotRunning) {
                triggerBotAutomation();
            }

            const h = Math.floor(diffSeconds / 3600);
            const m = Math.floor((diffSeconds % 3600) / 60);
            const s = diffSeconds % 60;

            const parts = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0 || h > 0) parts.push(`${m}m`);
            parts.push(`${s}s`);

            setCountdownToNext(parts.join(' '));
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [socialBotSettings.enabled, socialBotSettings.posting_times, isBotRunning]);

    // Countdown pre AI Autopilot (každú hodinu)
    useEffect(() => {
        if (!autopilotSettings.enabled) {
            setCountdownAutopilot("");
            return;
        }

        const updateAutopilotCountdown = () => {
            const now = new Date();
            // Najbližšia celá hodina
            const nextHour = new Date(now);
            nextHour.setHours(now.getHours() + 1, 0, 0, 0);

            const diffSeconds = Math.floor((nextHour.getTime() - now.getTime()) / 1000);

            if (diffSeconds === 0) {
                fetchAutopilotSettings();
            }

            const h = Math.floor(diffSeconds / 3600);
            const m = Math.floor((diffSeconds % 3600) / 60);
            const s = diffSeconds % 60;

            const parts = [];
            if (h > 0) parts.push(`${h}h`);
            parts.push(`${m}m`);
            parts.push(`${s}s`);

            setCountdownAutopilot(parts.join(' '));
        };

        updateAutopilotCountdown();
        const timer = setInterval(updateAutopilotCountdown, 1000);
        return () => clearInterval(timer);
    }, [autopilotSettings.enabled]);

    // Polling bot status when on social tab
    useEffect(() => {
        if (activeTab !== "social" || !socialBotSettings.enabled) return;

        const poll = setInterval(() => {
            fetchAutopilotSettings();
        }, 10000); // Poll every 10 seconds for status updates

        return () => clearInterval(poll);
    }, [activeTab, socialBotSettings.enabled]);


    // Authentication state
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedDiscoveryCategory, setSelectedDiscoveryCategory] = useState("Všetky");
    const [selectedPublishedCategory, setSelectedPublishedCategory] = useState("Všetky");
    const [discoveryDays, setDiscoveryDays] = useState("3");
    const [discoveryTargetCategories, setDiscoveryTargetCategories] = useState<string[]>([]);

    // Discovery Loading Modal states
    const [isDiscoveringModalOpen, setIsDiscoveringModalOpen] = useState(false);
    const [discoveryStage, setDiscoveryStage] = useState("Inicializácia umelej inteligencie...");

    // Generating Loading Modal states
    const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
    const [generatingStage, setGeneratingStage] = useState("Inicializácia AI modelov...");

    // Autopilot Loading Modal states
    const [isAutopilotLoadingModalOpen, setIsAutopilotLoadingModalOpen] = useState(false);
    const [autopilotLoadingStage, setAutopilotLoadingStage] = useState("Inicializácia Autopilota...");

    const [isAutopilotHistoryOpen, setIsAutopilotHistoryOpen] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [autopilotHistory, setAutopilotHistory] = useState<AutopilotHistoryItem[]>([]);

    const [isBulkCategoryMode, setIsBulkCategoryMode] = useState(false);
    const [bulkSelectedArticles, setBulkSelectedArticles] = useState<string[]>([]);
    const [refreshingType, setRefreshingType] = useState<"none" | "bulk" | "recent" | "all">("none");
    const [plannedPosts, setPlannedPosts] = useState<SocialPost[]>([]);
    const [isSocialAutopilotGenerating, setIsSocialAutopilotGenerating] = useState(false);
    const [plannedCategoryFilter, setPlannedCategoryFilter] = useState<string>("all");
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [automationArticleData, setAutomationArticleData] = useState<{ id: string, title: string } | null>(null);

    // Full Automation States
    const [selectedFullAutomationCategory, setSelectedFullAutomationCategory] = useState("AI");
    const [isFullAutomationLoading, setIsFullAutomationLoading] = useState(false);

    const fetchArticles = async () => {
        setLoadingArticles(true);
        const { data, error } = await supabase
            .from("articles")
            .select("*")
            .order("published_at", { ascending: false });

        if (!error && data) {
            setArticles(data);
        }
        setLoadingArticles(false);
    };

    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        const { data, error } = await supabase
            .from("suggested_news")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (!error && data) {
            setSuggestions(data);
        }
        setLoadingSuggestions(false);
    };

    const fetchPlannedPosts = async () => {
        try {
            const res = await fetch("/api/admin/social-posts");
            const data = await res.json();
            console.log("Fetched planned posts:", data);
            if (!data.error) {
                setPlannedPosts(data);
                // Stats update - previously unused
                /*
                const published = (data || []).filter((p: SocialPost) => p.status === 'posted').length;
                const drafts = (data || []).filter((p: SocialPost) => p.status === 'draft').length;
                // setSocialStats({ total_published: published, pending_drafts: drafts });
                */
            }
        } catch (e) {
            console.error("Failed to fetch planned posts", e);
        }
    };

    const handleSocialAutopilot = async () => {
        setIsSocialAutopilotGenerating(true);
        setStatus("loading");
        setGeneratingStage("AI analyzuje články a vyberá témy pre sociálne siete...");
        setIsGeneratingModalOpen(true);

        try {
            const res = await fetch("/api/admin/social-autopilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platforms: ['Instagram', 'Facebook', 'X'] }),
            });
            const data = await res.json();

            if (data.posts && data.posts.length > 0) {
                await fetchPlannedPosts();
                setStatus("success");
                setMessage("AI Automatizátor úspešne naplánoval nové príspevky!");
            } else {
                setMessage(data.message || "Žiadne nové zaujímavé články na spracovanie.");
                setStatus("success");
            }
        } catch (e) {
            console.error(e);
            setStatus("error");
            setMessage("Chyba pri AI automatizácii.");
        } finally {
            setIsSocialAutopilotGenerating(false);
            setIsGeneratingModalOpen(false);
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleFullAutomationSingle = async () => {
        setIsFullAutomationLoading(true);
        setStatus("loading");
        setGeneratingStage("Inicializácia plnej automatizácie...");
        setIsGeneratingModalOpen(true);

        try {
            // STEP 1: Discovery (Using GET to match working Discovery tab)
            setGeneratingStage(`Hľadám nové témy v kategórii ${selectedFullAutomationCategory}...`);

            const params = new URLSearchParams();
            params.append("days", "3");
            if (selectedFullAutomationCategory !== "Všetky") {
                params.append("categories", selectedFullAutomationCategory);
            }
            params.append("secret", "make-com-webhook-secret");

            const discRes = await fetch(`/api/admin/discover-news?${params.toString()}`);
            const discData = await discRes.json();

            if (!discRes.ok) throw new Error(discData.message || "Nepodarilo sa nájsť nové témy.");

            const foundItems = discData.items || discData.suggestions || [];
            if (foundItems.length === 0) {
                throw new Error("Nenašli sa žiadne nové správy pre túto kategóriu.");
            }

            // FILTER already processed articles to pick a FRESH topic
            setGeneratingStage("Kontrolujem existujúce články...");
            const { data: latestArticles } = await supabase.from("articles").select("source_url");
            const existingUrls = (latestArticles || []).map(a => (a.source_url || "").trim().toLowerCase());

            const freshItems = foundItems.filter((item: SuggestedNews) => {
                const url = (item.url || "").trim().toLowerCase();
                return url && !existingUrls.includes(url);
            });

            if (freshItems.length === 0) {
                // If all found items are already processed, tell the user gracefully
                setStatus("success");
                setMessage("Všetky nové správy v tejto kategórii už boli spracované.");
                setIsFullAutomationLoading(false);
                setTimeout(() => {
                    setIsGeneratingModalOpen(false);
                    setStatus("idle");
                }, 3000);
                return;
            }

            // STEP 2: Pick the first FRESH item
            const target = freshItems[0];

            // STEP 3: Generate Article (Publish immediately)
            setGeneratingStage(`Generujem kompletný článok: ${target.title}...`);
            const genRes = await fetch("/api/admin/generate-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: target.url,
                    status: 'published',
                    secret: "make-com-webhook-secret"
                })
            });
            const genData = await genRes.json();
            if (!genData.success) throw new Error(genData.message || "Chyba pri generovaní článku.");

            const newlyCreatedArticleId = genData.article.id;
            await fetchArticles();

            // STEP 4: Social Autopilot (Drafting)
            setGeneratingStage(`Pripravujem príspevky pre sociálne siete...`);
            const socialRes = await fetch("/api/admin/social-autopilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platforms: ['Facebook', 'Instagram', 'X'],
                    autoPublish: false, // We will publish manually after this to ensure high quality visuals
                    articleId: newlyCreatedArticleId,
                    secret: "make-com-webhook-secret"
                })
            });
            const socialData = await socialRes.json();
            console.log(">>> [Full Automation] Social Drafts:", socialData);

            if (socialData.posts && socialData.posts.length > 0) {
                // STEP 5: High-Quality Browser-Based Publishing
                setGeneratingStage(`Publikujem na Facebook a Instagram...`);

                // Set data for hidden renderer
                setAutomationArticleData({ id: newlyCreatedArticleId, title: genData.article.title });

                // Wait for the hidden preview element to be available in the DOM
                let previewEl: HTMLElement | null = null;
                for (let i = 0; i < 20; i++) {
                    previewEl = document.getElementById('automation-preview-capture');
                    if (previewEl) break;
                    await new Promise(r => setTimeout(r, 200));
                }

                if (previewEl) {
                    // Short stability pause (fonts/rendering)
                    await new Promise(r => setTimeout(r, 800));

                    // Capture the high-quality image blob
                    const imageBlob = await toBlob(previewEl, { cacheBust: true, width: 1080, height: 1080, pixelRatio: 1 });

                    let socialSuccessCount = 0;
                    for (const post of (socialData.posts as { id: string, platform: string }[])) {
                        if (post.platform === 'X') continue; // Skip X for now as requested

                        setGeneratingStage(`Odosielam príspevok na ${post.platform}...`);

                        const formData = new FormData();
                        formData.append("id", post.id || "0"); // If ID missing from draft response, this might fail, but social-autopilot returns created posts
                        formData.append("secret", "make-com-webhook-secret");
                        if (imageBlob && post.platform === 'Instagram') {
                            formData.append("image", imageBlob, "social-post.png");
                        }

                        const pubRes = await fetch("/api/admin/publish-social-post", { method: "POST", body: formData });
                        if (pubRes.ok) socialSuccessCount++;
                    }
                    console.log(`>>> [Full Automation] Published ${socialSuccessCount} posts.`);
                }
            }

            await fetchPlannedPosts();
            setStatus("success");
            setMessage("Plná automatizácia úspešne dokončená! Článok aj príspevky sú vonku.");

        } catch (error: unknown) {
            console.error("Full Automation failed:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba počas plnej automatizácie.");
        } finally {
            setIsFullAutomationLoading(false);
            setTimeout(() => {
                setIsGeneratingModalOpen(false);
                setStatus("idle");
                setMessage("");
            }, 3000);
        }
    };

    const handleManualCustomBotRun = async () => {
        if (!customBotPrompt.trim()) {
            alert("Prosím, zadaj zadanie pre AI bota.");
            return;
        }

        setIsCustomBotRunning(true);
        setStatus("loading");
        setGeneratingStage("Agent prijíma vaše pokyny...");
        setIsGeneratingModalOpen(true);

        try {
            // STEP 1: Generate Article
            setGeneratingStage("AI asistent spracováva tému a píše článok...");
            const res = await fetch("/api/admin/manual-custom-bot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: customBotPrompt,
                    postSocial: customBotPostSocial,
                    publishStatus: customBotPublishStatus,
                    secret: "make-com-webhook-secret"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Chyba pri generovaní");

            const articleId = data.article.id;
            const articleTitle = data.article.title;

            // STEP 2: Optional Social Media Capture & Publish
            if (customBotPostSocial && customBotPublishStatus === 'published') {
                setGeneratingStage("Pripravujem vizuály a príspevky pre siete...");

                // Initial social drafting already happened in the API call
                // Now we replicate the high-quality capture from Full Automation if possible
                setAutomationArticleData({ id: articleId, title: articleTitle });

                // Wait for renderer
                let previewEl: HTMLElement | null = null;
                for (let i = 0; i < 20; i++) {
                    previewEl = document.getElementById('automation-preview-capture');
                    if (previewEl) break;
                    await new Promise(r => setTimeout(r, 200));
                }

                if (previewEl) {
                    await new Promise(r => setTimeout(r, 800));
                    const imageBlob = await toBlob(previewEl, { cacheBust: true, width: 1080, height: 1080, pixelRatio: 1 });

                    if (data.social?.posts && data.social.posts.length > 0) {
                        for (const post of (data.social.posts as { id: string, platform: string, status: string }[])) {
                            if (post.platform === 'X') continue;
                            setGeneratingStage(`Odosielam príspevok na ${post.platform}...`);

                            const formData = new FormData();
                            formData.append("id", post.id);
                            formData.append("secret", "make-com-webhook-secret");
                            if (imageBlob && post.platform === 'Instagram') {
                                formData.append("image", imageBlob, "social-post.png");
                            }

                            await fetch("/api/admin/publish-social-post", { method: "POST", body: formData });
                        }
                    }
                }
            }

            setStatus("success");
            setMessage(`Úspech! Článok "${articleTitle}" bol vytvorený.`);
            setCustomBotPrompt("");
            fetchArticles();
            fetchPlannedPosts();

        } catch (error: unknown) {
            console.error("Custom Bot Run failed:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba počas behu AI agenta");
        } finally {
            setIsCustomBotRunning(false);
            setTimeout(() => {
                setIsGeneratingModalOpen(false);
                setStatus("idle");
                setMessage("");
            }, 3000);
        }
    };

    const handleToggleSocialPosted = async (post: SocialPost) => {
        const newStatus = post.status === 'posted' ? 'draft' : 'posted';
        try {
            await fetch("/api/admin/social-posts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: post.id,
                    status: newStatus,
                    posted_at: newStatus === 'posted' ? new Date().toISOString() : null
                }),
            });
            await fetchPlannedPosts();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteSocialPost = async (id: string) => {
        if (!confirm("Naozaj chcete zmazať tento naplánovaný príspevok?")) return;
        try {
            await fetch("/api/admin/social-posts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            await fetchPlannedPosts();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteAllSocialPosts = async () => {
        if (!confirm("Naozaj chcete vymazať VŠETKY naplánované príspevky? Táto akcia je nevratná.")) return;
        setStatus("loading");
        setMessage("Mažem všetky príspevky...");
        try {
            // Pre jednoduchosť a bezpečnosť mažeme príspevky postupne alebo hromadne cez Supabase priamo
            const { error } = await supabase.from('social_posts').delete().neq('id', '0'); // zmaže všetko
            if (error) throw error;

            await fetchPlannedPosts();
            setStatus("success");
            setMessage("Všetky príspevky boli vymazané.");
        } catch (e) {
            console.error(e);
            setStatus("error");
            setMessage("Chyba pri mazaní príspevkov.");
        } finally {
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handlePublishSocialPost = async (id: string) => {
        if (!confirm("Chcete tento príspevok TERAZ publikovať na zvolenú platformu pomocou API?")) return;

        setStatus("loading");
        setMessage("Pripravujem vizuál príspevku...");

        try {
            // Polling for readiness (max 5 seconds)
            let isReady = false;
            for (let i = 0; i < 25; i++) {
                const el = document.getElementById('planner-preview-capture') || document.getElementById('instagram-preview-capture');
                if (el && el.getAttribute('data-ready') === 'true') {
                    isReady = true;
                    break;
                }
                setMessage(`Pripravujem dáta (${Math.round((i / 25) * 100)}%)...`);
                await new Promise(r => setTimeout(r, 200));
            }

            if (!isReady) {
                console.warn("[Admin] Preview not ready after 5s, capturing anyway...");
            }

            // New logic: Capture the preview client-side for "Perfect" results
            const previewEl = document.getElementById('planner-preview-capture') || document.getElementById('instagram-preview-capture');
            let imageBlob: Blob | null = null;

            if (previewEl) {
                try {
                    imageBlob = await toBlob(previewEl, {
                        cacheBust: true,
                        width: 1080,
                        height: 1080,
                        pixelRatio: 1,
                    });
                    console.log("[Admin] Captured bit-perfect preview PNG");
                } catch (captureErr) {
                    console.warn("[Admin] Preview capture failed, falling back to server-side generation", captureErr);
                }
            }

            setMessage("Odosielam na Meta API...");

            const formData = new FormData();
            formData.append("id", id);
            formData.append("secret", "make-com-webhook-secret");
            if (imageBlob) {
                formData.append("image", imageBlob, "social-post.png");
            }

            const res = await fetch("/api/admin/publish-social-post", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setMessage("Príspevok úspešne publikovaný!");
                await fetchPlannedPosts();
            } else {
                throw new Error(data.error || "Chyba pri publikovaní");
            }
        } catch (e: unknown) {
            console.error(e);
            setStatus("error");
            setMessage(e instanceof Error ? e.message : "Nepodarilo sa publikovať");
        } finally {
            setTimeout(() => setStatus("idle"), 4000);
        }
    };

    const handlePublishMultiplePosts = async () => {
        if (selectedPostsForPublishing.length === 0) return;
        if (!confirm(`Chcete publikovať vybraných ${selectedPostsForPublishing.length} príspevkov na sociálne siete?`)) return;

        setStatus("loading");

        let successCount = 0;

        try {
            setMessage("Pripravujem vizuál príspevkov...");

            // Polling for readiness (max 5 seconds)
            let isReady = false;
            for (let i = 0; i < 25; i++) {
                const el = document.getElementById('planner-preview-capture') || document.getElementById('instagram-preview-capture');
                if (el && el.getAttribute('data-ready') === 'true') {
                    isReady = true;
                    break;
                }
                setMessage(`Pripravujem dáta (${Math.round((i / 25) * 100)}%)...`);
                await new Promise(r => setTimeout(r, 200));
            }

            if (!isReady) {
                console.warn("[Admin] Bulk preview not ready after 5s, capturing anyway...");
            }

            const previewEl = document.getElementById('planner-preview-capture') || document.getElementById('instagram-preview-capture');
            let imageBlob: Blob | null = null;

            if (previewEl) {
                imageBlob = await toBlob(previewEl, {
                    cacheBust: true,
                    width: 1080,
                    height: 1080,
                    pixelRatio: 1,
                });
            }

            for (const postId of selectedPostsForPublishing) {
                setMessage(`Publikujem ${successCount + 1}/${selectedPostsForPublishing.length}...`);
                const formData = new FormData();
                formData.append("id", postId);
                formData.append("secret", "make-com-webhook-secret");
                if (imageBlob) {
                    formData.append("image", imageBlob, "social-post.png");
                }

                const res = await fetch("/api/admin/publish-social-post", {
                    method: "POST",
                    body: formData,
                });
                if (res.ok) successCount++;
            }

            setStatus("success");
            setMessage(`Úspešne publikovaných ${successCount} príspevkov.`);
            setSelectedPostsForPublishing([]);
            await fetchPlannedPosts();
        } catch (e: unknown) {
            console.error(e);
            setStatus("error");
            setMessage("Vyskytla sa chyba pri hromadnom publikovaní.");
        } finally {
            setTimeout(() => setStatus("idle"), 4000);
        }
    };

    // handlePublishNextPendingArticle commented out as it is currently unused
    /*
    const handlePublishNextPendingArticle = async () => {
        // ...
    };
    */

    const fetchAutopilotSettings = async () => {
        // Fetch Auto Pilot
        const { data: apData, error: apError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'auto_pilot')
            .single();

        if (!apError && apData) {
            setAutopilotSettings(apData.value as AutopilotSettings);
        }

        // Fetch Social Bot
        const { data: sbData, error: sbError } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'social_bot')
            .single();

        if (!sbError && sbData) {
            setSocialBotSettings(sbData.value as SocialBotSettings);
        }
    };

    const handleSaveSocialBotSettings = async (settings: SocialBotSettings) => {
        setSocialBotSettings(settings);
        const { error } = await supabase
            .from('site_settings')
            .upsert({ key: 'social_bot', value: settings }, { onConflict: 'key' });

        if (!error) {
            setStatus("success");
            setMessage("Nastavenia Social Bot-a boli uložené.");
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setStatus("error");
            setMessage("Chyba pri ukladaní nastavení.");
        }
    };

    const handleGenerateSocialPosts = async () => {
        if (socialSelectedArticles.length === 0) return;
        setIsGeneratingSocial(true);
        setStatus("loading");
        setMessage("Generujem príspevky...");

        try {
            const results: Record<string, Record<string, string>> = { ...socialResults };
            const postsToSave: Omit<SocialPost, 'id' | 'created_at' | 'articles'>[] = [];

            for (const articleId of socialSelectedArticles) {
                const article = articles.find(a => a.id === articleId);
                if (!article) continue;

                if (!results[articleId]) results[articleId] = {};

                for (const platform of socialPlatforms) {
                    const res = await fetch("/api/admin/generate-social-post", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: article.title,
                            excerpt: article.excerpt,
                            url: `https://postovinky.news/article/${article.slug}`,
                            platform: platform
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        results[articleId][platform] = data.socialPost;
                        postsToSave.push({
                            article_id: articleId,
                            platform: platform,
                            content: data.socialPost,
                            status: 'draft'
                        });
                    }
                }
            }

            if (postsToSave.length > 0) {
                const { error } = await supabase.from('social_posts').insert(postsToSave);
                if (error) console.error("Chyba pri ukladaní postov:", error);
                fetchPlannedPosts();
            }

            setSocialResults(results);
            setStatus("success");
            setMessage("Príspevky uložené do plánovača!");
        } catch (err) {
            console.error("Failed to generate social posts:", err);
            setStatus("error");
            setMessage("Chyba pri generovaní príspevkov");
        } finally {
            setIsGeneratingSocial(false);
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Skopírované!");
    };

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const { data: allData, error: allDataError } = await supabase
                .from('site_visits')
                .select('path, visitor_id, country, city, region, timezone, latitude, longitude, device, browser, os, created_at, user_agent, referrer');

            if (allDataError) throw allDataError;

            const totalVisits = allData?.length || 0;
            const uniqueVisitors = new Set(allData?.map(v => v.visitor_id).filter(Boolean)).size;

            // Today's stats
            const todayStr = new Date().toISOString().split('T')[0];
            const todayData = allData?.filter(v => v.created_at.startsWith(todayStr)) || [];
            const todayVisits = todayData.length;
            const todayUnique = new Set(todayData.map(v => v.visitor_id).filter(Boolean)).size;

            // Daily stats for last 30 days
            const dailyStatsMap: Record<string, { visits: number, visitors: Set<string> }> = {};
            const now = new Date();
            for (let i = 0; i < 30; i++) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                dailyStatsMap[dateStr] = { visits: 0, visitors: new Set() };
            }

            // Page stats
            const pageCounts: Record<string, number> = {};
            // Country stats
            const countryCounts: Record<string, number> = {};
            // Device stats
            const deviceCounts: Record<string, number> = {};
            // Browser stats
            const browserCounts: Record<string, number> = {};

            allData?.forEach(v => {
                const dateStr = v.created_at.split('T')[0];
                if (dailyStatsMap[dateStr]) {
                    dailyStatsMap[dateStr].visits++;
                    if (v.visitor_id) dailyStatsMap[dateStr].visitors.add(v.visitor_id);
                }

                pageCounts[v.path] = (pageCounts[v.path] || 0) + 1;
                const c = v.country || 'Unknown';
                countryCounts[c] = (countryCounts[c] || 0) + 1;
                const d = v.device || 'desktop';
                deviceCounts[d] = (deviceCounts[d] || 0) + 1;
                const b = v.browser || 'Other';
                browserCounts[b] = (browserCounts[b] || 0) + 1;
            });

            const dailyStats = Object.entries(dailyStatsMap)
                .map(([date, data]) => ({
                    date,
                    visits: data.visits,
                    unique: data.visitors.size
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

            const topPages = Object.entries(pageCounts)
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const countries = Object.entries(countryCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            const devices = Object.entries(deviceCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            const browsers = Object.entries(browserCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            const recentVisits = [...(allData || [])]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 30);

            const { data: subscriberData, error: subscriberError } = await supabase
                .from('newsletter_subscribers')
                .select('email, updated_at')
                .order('updated_at', { ascending: false });

            if (subscriberError) throw subscriberError;

            setAnalytics({
                totalVisits,
                uniqueVisitors,
                todayVisits,
                todayUnique,
                topPages,
                countries,
                devices,
                browsers,
                dailyStats,
                recentVisits,
                newsletterSubscribers: subscriberData || []
            });
        } catch (err) {
            console.error("Analytics fetch error:", err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const loggedInUser = localStorage.getItem("admin_logged_in");
            if (loggedInUser === "true") {
                setIsLoggedIn(true);
                fetchArticles();
                fetchSuggestions();
                fetchAutopilotSettings();
                fetchAnalytics();
                fetchPlannedPosts();
            }
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsAutopilotHistoryOpen(false);
                setIsDiscoveringModalOpen(false);
                setIsGeneratingModalOpen(false);
                setIsAutopilotLoadingModalOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        if (email === "cmelo.marek@gmail.com" && password === "Marek6296") {
            setIsLoggedIn(true);
            localStorage.setItem("admin_logged_in", "true");
            window.dispatchEvent(new Event('storage'));
            fetchArticles();
            fetchSuggestions();
        } else {
            setLoginError("Nesprávny e-mail alebo heslo");
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        localStorage.removeItem("admin_logged_in");
        window.dispatchEvent(new Event('storage'));
        setArticles([]);
    };

    const handleSynthesis = async (e: React.FormEvent) => {
        e.preventDefault();
        const validUrls = synthesisUrls.filter(u => u.trim());
        if (validUrls.length === 0) return;

        setStatus("loading");
        setIsGeneratingModalOpen(true);
        setGeneratingStage("Príprava Synthesis Studia...");

        const stages = [
            "Sťahujem dáta z URL adries...",
            "Analyzujem texty zdrojov...",
            "Porovnávam fakty z viacerých zdrojov...",
            "OpenAI navrhuje najlepší nadpis...",
            "Generujem pútavý slovenský článok...",
            "Sťahujem a optimalizujem obrázky...",
            "Dokončujem ukladanie článku..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setGeneratingStage(stages[stageIdx]);
        }, 4000);

        try {
            const res = await fetch("/api/admin/generate-article-multi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: validUrls, secret: "make-com-webhook-secret" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Nepodarilo sa vykonať syntézu");
            setStatus("success");
            setMessage(`Úspech! Syntéza "${data.article?.title}" bola uložená ako DRAFT.`);
            setSynthesisUrls([""]);
            fetchArticles();
            setActiveTab("manage");
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri syntéze");
        } finally {
            clearInterval(interval);
            setIsGeneratingModalOpen(false);
        }
    };

    const triggerArticleGeneration = async (targetUrl: string) => {
        if (!targetUrl) return;

        setStatus("loading");
        setIsGeneratingModalOpen(true);
        setGeneratingStage("Sťahovanie zdrojového článku...");

        const stages = [
            "Analyzujem obsah pomocou AI...",
            "Prekladám do profesionálnej slovenčiny...",
            "Ladím štýl a formátovanie článku...",
            "Sťahujem a optimalizujem obrázky...",
            "Finálne úpravy a ukladanie..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setGeneratingStage(stages[stageIdx]);
        }, 3500);

        try {
            const res = await fetch("/api/admin/generate-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: targetUrl, secret: "make-com-webhook-secret" })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Nepodarilo sa vygenerovať článok");
            setStatus("success");
            setMessage(`Úspech! Článok "${data.article?.title}" bol prijatý ako DRAFT.`);
            setUrl("");
            fetchArticles();
            setActiveTab("manage");
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri generovaní");
        } finally {
            clearInterval(interval);
            setIsGeneratingModalOpen(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        await triggerArticleGeneration(url);
    };

    const handlePublish = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === "published" ? "draft" : "published";
        const { error } = await supabase.from("articles").update({ status: newStatus }).eq("id", id);
        if (!error) {
            fetchArticles();
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri zmene statusu: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Naozaj vymazať článok?")) return;
        const { error } = await supabase.from("articles").delete().eq("id", id);
        if (!error) {
            fetchArticles();
            await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
        } else {
            alert("Chyba pri mazaní: " + error.message);
        }
    };

    const toggleBulkSelection = (id: string) => {
        setBulkSelectedArticles(prev =>
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleRefreshCategories = async () => {
        if (bulkSelectedArticles.length === 0) return;
        setRefreshingType("bulk");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: bulkSelectedArticles
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setIsBulkCategoryMode(false);
                setBulkSelectedArticles([]);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleRefreshRecentCategories = async () => {
        const recentIds = articles
            .filter(a => a.status === 'published')
            .slice(0, 20)
            .map(a => a.id);

        if (recentIds.length === 0) {
            alert("Nájdených 0 článkov na opravu.");
            return;
        }

        if (!confirm(`AI teraz preanalyzuje a opraví kategórie pre ${recentIds.length} posledných článkov. Pokračovať?`)) return;

        setRefreshingType("recent");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: recentIds
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleRefreshAllCategories = async () => {
        const allIds = articles
            .filter(a => a.status === 'published')
            .map(a => a.id);

        if (allIds.length === 0) {
            alert("Nájdených 0 článkov na opravu.");
            return;
        }

        if (!confirm(`POZOR: AI teraz preanalyzuje a opraví kategórie pre VŠETKÝCH ${allIds.length} článkov v databáze. Toto môže trvať dlhšie. Pokračovať?`)) return;

        setRefreshingType("all");
        setStatus("loading");
        try {
            const response = await fetch("/api/admin/refresh-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: 'make-com-webhook-secret',
                    articleIds: allIds
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                fetchArticles();
                await fetch("/api/revalidate?secret=make-com-webhook-secret", { method: "POST" });
            } else {
                alert("Chyba: " + data.message);
            }
        } catch (e: unknown) {
            const error = e as Error;
            alert("API chyba: " + error.message);
        } finally {
            setRefreshingType("none");
            setStatus("idle");
        }
    };

    const handleDiscoverNews = async () => {
        setStatus("loading");
        setIsDiscoveringModalOpen(true);
        setDiscoveryStage("Pripájam sa na zdroje dát...");

        const stages = [
            "Pripájam sa na zdroje dát...",
            "Prehľadávam najlepšie technologické weby a RSS kanály...",
            "Sťahujem stovky najnovších článkov z posledných dní...",
            "AI asistent analyzuje titulky a porovnáva obsah...",
            "Oddeľuje absolútne klenoty od zbytočného šumu...",
            "Extrahuje kľúčové informácie a obohacuje detaily...",
            "Pripravujem konečný zoznam tých najlepších tém...",
            "Čakám na finálnu odpoveď od OpenAI serverov..."
        ];

        let currentStageIdx = 0;
        const progressInterval = setInterval(() => {
            currentStageIdx = (currentStageIdx + 1) % stages.length;
            setDiscoveryStage(stages[currentStageIdx]);
        }, 4000);

        try {
            const params = new URLSearchParams({
                secret: "make-com-webhook-secret",
                days: discoveryDays,
            });
            if (discoveryTargetCategories.length > 0) {
                params.append("categories", discoveryTargetCategories.join(","));
            }
            const res = await fetch(`/api/admin/discover-news?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStatus("success");
            setMessage(data.message || "Boli objavené nové témy!");
            fetchSuggestions();
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba pri objavovaní správ");
        } finally {
            clearInterval(progressInterval);
            setIsDiscoveringModalOpen(false);
        }
    };

    const handleIgnoreSuggestion = async (id: string) => {
        const { error } = await supabase.from("suggested_news").update({ status: 'ignored' }).eq("id", id);
        if (!error) fetchSuggestions();
    };

    const handleClearAllSuggestions = async () => {
        if (!confirm("Naozaj chcete zmazať VŠETKY navrhované témy? Táto akcia je nevratná.")) return;

        setStatus("loading");
        setMessage("Mažem všetky návrhy...");

        const { error } = await supabase
            .from("suggested_news")
            .update({ status: 'ignored' })
            .eq("status", "pending");

        if (!error) {
            setStatus("success");
            setMessage("Všetky návrhy boli odstránené.");
            fetchSuggestions();
        } else {
            setStatus("error");
            setMessage("Chyba pri mazaní: " + error.message);
        }
    };

    const handleProcessSuggestion = async (suggestion: SuggestedNews) => {
        // Mark as processed in DB immediately
        await supabase.from("suggested_news").update({ status: 'processed' }).eq("id", suggestion.id);
        fetchSuggestions();

        // Start generation directly
        await triggerArticleGeneration(suggestion.url);
    };

    const executeAutopilotRun = async () => {
        setIsAutopilotManualRunning(true);
        setStatus("loading");
        setIsAutopilotLoadingModalOpen(true);
        setAutopilotLoadingStage("Štartujem Autopilota: Príprava zdrojov...");

        const stages = [
            "Analyzujem navrhované témy...",
            "Vyberám najlepšie správy z kategórií...",
            "Paralelné generovanie článkov (môže trvať 30-60s)...",
            "Prekladám do profesionálnej slovenčiny...",
            "Sťahujem a optimalizujem obrázky...",
            "Publikujem články na portál...",
            "Aktualizujem štatistiky Autopilota..."
        ];

        let stageIdx = 0;
        const interval = setInterval(() => {
            stageIdx = (stageIdx + 1) % stages.length;
            setAutopilotLoadingStage(stages[stageIdx]);
        }, 5000);

        try {
            console.log(">>> [UI] Starting Manual Autopilot Run...");
            const res = await fetch("/api/admin/auto-pilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: "make-com-webhook-secret", mode: 'manual' })
            });

            const data = await res.json();
            console.log(">>> [UI] Autopilot Response:", data);
            if (!res.ok) throw new Error(data.message);

            setStatus("success");
            setMessage(data.message);
            fetchSuggestions();
            fetchArticles();
            fetchAutopilotSettings();
        } catch (error: unknown) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Chyba Autopilota");
        } finally {
            clearInterval(interval);
            setIsAutopilotLoadingModalOpen(false);
            setIsAutopilotManualRunning(false);
        }
    };

    const handleToggleAutopilot = async () => {
        const newState = !autopilotSettings.enabled;
        const newSettings = { ...autopilotSettings, enabled: newState };

        setAutopilotSettings(newSettings);
        const { error } = await supabase
            .from('site_settings')
            .update({ value: newSettings })
            .eq('key', 'auto_pilot');

        if (!error) {
            setStatus("success");
            setMessage(newState ? "Autopilot bol zapnutý. Odteraz bude automaticky spracovávať novinky." : "Autopilot bol vypnutý.");

            if (newState) {
                if (confirm("Autopilot je aktivovaný! Chcete ho teraz spustiť, aby hneď vyhľadal a publikoval najnovšie správy? (Potom bude pokračovať automaticky každú hodinu)")) {
                    await executeAutopilotRun();
                }
            }

            fetchAutopilotSettings();
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
        }
    };

    const handleToggleSocialBot = async () => {
        const newState = !socialBotSettings.enabled;
        const newSettings = { ...socialBotSettings, enabled: newState };

        handleSaveSocialBotSettings(newSettings);
    };

    // handleRunAutopilotNow commented out because it is currently unused
    /*
    const handleRunAutopilotNow = async () => {
        if (confirm("Spustiť AI Autopilota teraz? Spracuje jeden článok z každej kategórie a publikuje ich.")) {
            await executeAutopilotRun();
        }
    };
    */

    const handleOpenAutopilotHistory = async () => {
        setIsAutopilotHistoryOpen(true);
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('suggested_news')
                .select('title, url, category, created_at')
                .eq('status', 'processed')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching autopilot history:", error);
                throw error;
            }

            console.log("Fetched autopilot history items:", data?.length, data);
            setAutopilotHistory(data || []);
        } catch (err) {
            console.error("Autopilot history catch:", err);
            // Fallback to empty to at least show the modal
            setAutopilotHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleResetAutopilotCount = async () => {
        if (!confirm("Vynulovať počítadlo spracovaných článkov?")) return;
        const newSettings = { ...autopilotSettings, processed_count: 0 };
        setAutopilotSettings(newSettings);
        await supabase
            .from('site_settings')
            .update({ value: newSettings })
            .eq('key', 'auto_pilot');
    };

    if (!isHydrated) {
        return <div className="min-h-screen bg-[#0a0a0a]" />;
    }

    if (!isLoggedIn) {
        return (
            <div className="container mx-auto px-4 py-20 max-w-md flex-grow flex items-center justify-center min-h-[70vh]">
                <div className="bg-card border rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black mb-2 uppercase tracking-widest">Postovinky</h1>
                        <p className="text-muted-foreground">Len pre autorizovaných redaktorov</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-foreground/70">E-mail</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-foreground/70">Heslo</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-background border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                        </div>
                        {loginError && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm font-medium text-center">{loginError}</div>}
                        <button type="submit" className="w-full bg-primary text-primary-foreground font-bold rounded-lg px-4 py-4 mt-4 transition-colors hover:bg-primary/90">Prihlásiť sa do redakcie</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="container mx-auto px-4 py-12 max-w-5xl flex-grow">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12 bg-card border p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm ring-1 ring-border/50">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black mb-1 md:mb-2 uppercase tracking-tight">Redakčný Systém</h1>
                        <p className="text-sm md:text-base text-muted-foreground font-medium">Správa obsahu a generovanie noviniek pomocou AI</p>
                    </div>
                    <button onClick={handleLogout} className="text-[10px] md:text-sm font-black text-muted-foreground hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-2 w-fit">
                        Odhlásiť sa <XCircle className="w-4 h-4" />
                    </button>
                </div>

                {/* Premium Admin Tabs – Responzívne riešenie */}
                <div className="w-full mb-10 md:mb-12 relative z-[60]">
                    {/* MOBILE DROPDOWN */}
                    <div className="md:hidden w-full">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="w-full flex items-center justify-between p-4 bg-card border rounded-2xl shadow-sm ring-1 ring-border/50 active:scale-[0.98] transition-all"
                        >
                            {(() => {
                                const currentTab = [
                                    { id: "discovery", label: "Trendy & Nápady", icon: Search, badge: suggestions.length, color: "text-blue-500", bg: "bg-blue-500", glow: "shadow-blue-500/20" },
                                    { id: "full_automation", label: "AI Autopilot", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500", glow: "shadow-yellow-500/20" },
                                    { id: "create", label: "Rýchla Tvorba", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500", glow: "shadow-purple-500/20" },
                                    { id: "manage", label: "Zoznam Článkov", icon: Edit, color: "text-green-500", bg: "bg-green-500", glow: "shadow-green-500/20" },
                                    { id: "analytics", label: "Analytika Webu", icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500", glow: "shadow-orange-500/20" },
                                    { id: "social", label: "Promo & Siete", icon: Share2, color: "text-pink-500", bg: "bg-pink-500", glow: "shadow-pink-500/20" }
                                ].find(t => t.id === activeTab);

                                if (!currentTab) return null;

                                return (
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl text-white shadow-sm", currentTab.bg)}>
                                            <currentTab.icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-60">Aktuálna sekcia</span>
                                            <span className="text-sm font-black uppercase tracking-tight">{currentTab.label}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                            <ChevronDown className={cn("w-6 h-6 text-muted-foreground transition-transform duration-300", isMobileMenuOpen && "rotate-180")} />
                        </button>

                        {isMobileMenuOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[70] ring-1 ring-black/10">
                                <div className="p-2 grid grid-cols-1 gap-1">
                                    {[
                                        { id: "discovery", label: "Trendy & Nápady", icon: Search, badge: suggestions.length, color: "text-blue-500", bg: "bg-blue-500", hover: "hover:bg-blue-500/10" },
                                        { id: "full_automation", label: "AI Autopilot", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500", hover: "hover:bg-yellow-500/10" },
                                        { id: "create", label: "Rýchla Tvorba", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500", hover: "hover:bg-purple-500/10" },
                                        { id: "manage", label: "Zoznam Článkov", icon: Edit, color: "text-green-500", bg: "bg-green-500", hover: "hover:bg-green-500/10" },
                                        { id: "analytics", label: "Analytika Webu", icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500", hover: "hover:bg-orange-500/10" },
                                        { id: "social", label: "Promo & Siete", icon: Share2, color: "text-pink-500", bg: "bg-pink-500", hover: "hover:bg-pink-500/10" }
                                    ].map((tab) => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id as "create" | "manage" | "discovery" | "analytics" | "social" | "autopilot" | "full_automation");
                                                    setIsMobileMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "flex items-center gap-4 w-full p-4 rounded-xl transition-all font-black text-xs uppercase tracking-widest",
                                                    isActive
                                                        ? `${tab.bg} text-white shadow-md`
                                                        : `text-muted-foreground hover:bg-muted/50`
                                                )}
                                            >
                                                <tab.icon className={cn("w-5 h-5", isActive ? "text-white" : tab.color)} />
                                                <span>{tab.label}</span>
                                                {tab.badge !== undefined && tab.badge > 0 && (
                                                    <span className={cn(
                                                        "ml-auto px-2 py-0.5 rounded-full text-[10px]",
                                                        isActive ? "bg-white text-foreground" : `${tab.bg} text-white`
                                                    )}>
                                                        {tab.badge}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DESKTOP TABS */}
                    <div className="hidden md:flex flex-nowrap items-center justify-start lg:justify-center gap-1.5 p-1.5 bg-muted/30 rounded-2xl md:rounded-full border border-border/40 backdrop-blur-md shadow-inner overflow-x-auto no-scrollbar">
                        {[
                            { id: "discovery", label: "Trendy & Nápady", icon: Search, badge: suggestions.length, color: "text-blue-500", bg: "bg-blue-500", hover: "hover:bg-blue-500/10", glow: "shadow-blue-500/20" },
                            { id: "full_automation", label: "AI Autopilot", icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500", hover: "hover:bg-yellow-500/10", glow: "shadow-yellow-500/20" },
                            { id: "create", label: "Rýchla Tvorba", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500", hover: "hover:bg-purple-500/10", glow: "shadow-purple-500/20" },
                            { id: "manage", label: "Zoznam Článkov", icon: Edit, color: "text-green-500", bg: "bg-green-500", hover: "hover:bg-green-500/10", glow: "shadow-green-500/20" },
                            { id: "analytics", label: "Analytika Webu", icon: BarChart3, color: "text-orange-500", bg: "bg-orange-500", hover: "hover:bg-orange-500/10", glow: "shadow-orange-500/20" },
                            { id: "social", label: "Promo & Siete", icon: Share2, color: "text-pink-500", bg: "bg-pink-500", hover: "hover:bg-pink-500/10", glow: "shadow-pink-500/20" }
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={cn(
                                        "relative flex items-center justify-center gap-2 px-3 py-2 md:px-4.5 md:py-2.5 rounded-xl md:rounded-full font-black text-[10px] md:text-[11px] uppercase tracking-wider transition-all duration-300 overflow-hidden shrink-0 group",
                                        isActive
                                            ? `${tab.bg} text-white shadow-lg z-10 scale-[1.02] ${tab.glow}`
                                            : `text-muted-foreground hover:text-foreground ${tab.hover} bg-background/50`
                                    )}
                                >
                                    <tab.icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-white" : tab.color)} />
                                    <span className="whitespace-nowrap">{tab.label}</span>
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-full font-black shrink-0 shadow-sm",
                                            isActive ? "bg-white text-foreground" : `${tab.bg} text-white`
                                        )}>
                                            {tab.badge}
                                        </span>
                                    )}
                                    {!isActive && (
                                        <div className={cn("absolute inset-y-0 left-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity", tab.bg)} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* CREATE TAB */}
                {activeTab === "create" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card border rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-sm flex flex-col relative overflow-hidden h-full ring-1 ring-border/50">
                            <div className="h-[200px] flex flex-col">
                                <div className="bg-primary/10 text-primary p-4 rounded-2xl w-fit mb-6">
                                    <Sparkles className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Synthesis Studio</h2>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed">Syntéza viacerých zdrojov do jedného článku.</p>
                            </div>
                            <div className="space-y-4 mb-8 flex-grow">
                                {synthesisUrls.map((sUrl, idx) => (
                                    <div key={idx} className="flex gap-2 group">
                                        <input
                                            type="url"
                                            value={sUrl}
                                            onChange={(e) => {
                                                const newUrls = [...synthesisUrls];
                                                newUrls[idx] = e.target.value;
                                                setSynthesisUrls(newUrls);
                                            }}
                                            placeholder="https://example.com/article..."
                                            className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                        />
                                        {synthesisUrls.length > 1 && (
                                            <button onClick={() => setSynthesisUrls(synthesisUrls.filter((_, i) => i !== idx))} className="p-3 text-muted-foreground hover:text-red-500 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setSynthesisUrls([...synthesisUrls, ""])} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity mt-2">
                                    <Plus className="w-4 h-4" /> Pridať zdroj
                                </button>
                            </div>
                            <button
                                onClick={handleSynthesis}
                                disabled={status === "loading" || synthesisUrls.filter(u => u.trim()).length === 0}
                                className="block w-full bg-primary text-primary-foreground text-center py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {status === "loading" ? "Generujem..." : "Spustiť Synthesis"}
                            </button>
                        </div>

                        <div className="bg-card border rounded-[40px] p-10 shadow-sm flex flex-col h-full ring-1 ring-border/50">
                            <div className="h-[200px] flex flex-col">
                                <div className="bg-muted text-foreground p-4 rounded-2xl w-fit mb-6">
                                    <Edit className="w-8 h-8" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Quick Gen</h2>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed">Rýchla adaptácia jedného článku.</p>
                            </div>
                            <form onSubmit={handleGenerate} className="flex flex-col flex-grow">
                                <div className="mb-8 flex-grow">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://techcrunch.com/..."
                                        required
                                        className="w-full bg-background border-2 border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all font-medium"
                                    />
                                </div>
                                <button type="submit" disabled={status === "loading" || !url} className="w-full bg-foreground text-background py-5 rounded-2xl font-black uppercase tracking-[0.15em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                    {status === "loading" ? "Generujem..." : "Vygenerovať Draft"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* DISCOVERY TAB */}
                {activeTab === "discovery" && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tight">Navrhované témy</h2>
                                <p className="text-muted-foreground font-medium">AI hľadá trendy na globálnych a lokálnych portáloch.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleClearAllSuggestions}
                                    disabled={status === "loading" || suggestions.length === 0}
                                    className="bg-red-500/10 text-red-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-3"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Vymazať všetko
                                </button>
                                <button
                                    onClick={handleDiscoverNews}
                                    disabled={status === "loading" || loadingSuggestions || discoveryTargetCategories.length === 0}
                                    className={cn(
                                        "bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg shadow-primary/20",
                                        (status === "loading" || loadingSuggestions || discoveryTargetCategories.length === 0) ? "opacity-50 cursor-not-allowed" : "hover:opacity-90 active:scale-95"
                                    )}
                                >
                                    {status === "loading" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Hľadať nové témy
                                </button>
                            </div>
                        </div>

                        {/* Discovery Settings Panel */}
                        <div className="bg-card/50 border border-border/40 p-5 md:p-6 rounded-3xl shadow-sm backdrop-blur-sm flex flex-col lg:flex-row gap-6 md:gap-20 items-stretch md:items-start">
                            {/* Max Age Column */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 rounded-full bg-primary/80 animate-pulse"></div>
                                    <label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/80">Stárosť správ (Max Age)</label>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { value: "1", label: "24h" },
                                        { value: "3", label: "3 dni" },
                                        { value: "7", label: "Týždeň" },
                                        { value: "30", label: "Mesiac" }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setDiscoveryDays(opt.value)}
                                            className={cn(
                                                "px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                                                discoveryDays === opt.value
                                                    ? "bg-foreground text-background border-foreground shadow-sm"
                                                    : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Target Categories Column */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 rounded-full bg-primary/80 animate-pulse"></div>
                                    <label className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/80">Cieliť na sekcie (Viacero možností)</label>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(() => {
                                        const allCats = ["Novinky SK/CZ", "AI", "Tech", "Biznis", "Krypto", "Svet", "Politika", "Gaming", "Veda", "Návody & Tipy"];
                                        const isAllSelected = discoveryTargetCategories.length === allCats.length;

                                        return (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (isAllSelected) {
                                                            setDiscoveryTargetCategories([]);
                                                        } else {
                                                            setDiscoveryTargetCategories(allCats);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                                                        isAllSelected
                                                            ? "bg-primary border-primary text-primary-foreground shadow-md"
                                                            : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                    )}
                                                >
                                                    {isAllSelected && <CheckCircle2 className="w-3 h-3" />}
                                                    VŠETKY
                                                </button>

                                                {allCats.map((cat) => {
                                                    const isSelected = discoveryTargetCategories.includes(cat);
                                                    return (
                                                        <button
                                                            key={cat}
                                                            onClick={() => {
                                                                setDiscoveryTargetCategories(prev =>
                                                                    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                                                                );
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5",
                                                                isSelected
                                                                    ? "bg-foreground text-background border-foreground shadow-sm"
                                                                    : "bg-background/50 border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                                            )}
                                                        >
                                                            {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                                            {cat}
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Discovery Items List */}
                        {suggestions.length === 0 ? (
                            <div className="bg-card border border-dashed rounded-[32px] md:rounded-[40px] p-10 md:p-24 text-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 text-2xl md:text-3xl">✨</div>
                                <h3 className="text-xl md:text-2xl font-black uppercase mb-3 text-foreground/80">Všetko je spracované</h3>
                                <p className="text-muted-foreground text-sm md:text-base font-medium">Momentálne nemáte žiadne nové návrhy.</p>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                <div className="flex flex-wrap gap-2 p-1.5 bg-muted/30 rounded-2xl w-fit border border-border/50">
                                    <button onClick={() => setSelectedDiscoveryCategory("Všetky")} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedDiscoveryCategory === "Všetky" ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}>Všetky ({suggestions.length})</button>
                                    {Object.entries(suggestions.reduce((acc, curr) => { const cat = curr.category || "Nezaradené"; acc[cat] = (acc[cat] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([cat, count]) => (
                                        <button key={cat} onClick={() => setSelectedDiscoveryCategory(cat)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedDiscoveryCategory === cat ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}>{cat} ({count})</button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                    {suggestions.filter(s => {
                                        const itemCat = s.category || "Nezaradené";
                                        return selectedDiscoveryCategory === "Všetky" || itemCat === selectedDiscoveryCategory;
                                    }).map((suggestion) => (
                                        <div key={suggestion.id} className="bg-card border rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-md hover:border-primary/40 transition-all group flex flex-col h-full ring-1 ring-border/50">
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="flex flex-wrap gap-3">
                                                    <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">{suggestion.source}</span>
                                                    <span className="bg-muted text-muted-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-border/50">{suggestion.category || "Nezaradené"}</span>
                                                </div>
                                                <button onClick={() => handleIgnoreSuggestion(suggestion.id)} className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><XCircle className="w-6 h-6" /></button>
                                            </div>
                                            <h3 className="text-2xl font-black leading-tight mb-6 group-hover:text-primary transition-colors">{suggestion.title}</h3>
                                            <p className="text-base text-muted-foreground mb-10 line-clamp-4 leading-relaxed font-medium">{suggestion.summary}</p>
                                            <div className="mt-auto pt-8 border-t border-border/50 flex items-center justify-between">
                                                <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-muted-foreground hover:text-foreground flex items-center gap-2 uppercase tracking-widest transition-colors"><Globe className="w-4 h-4" /> Zdroj</a>
                                                <button onClick={() => handleProcessSuggestion(suggestion)} className="bg-foreground text-background px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.05] active:scale-[0.95] transition-all flex items-center gap-3 shadow-xl">Spracovať článok</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* FULL AUTOMATION TAB */}
                {activeTab === "full_automation" && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tight">Úplná automatizácia</h2>
                            <p className="text-muted-foreground font-medium">Riadiace centrum pre všetkých AI agentov a automatické procesy.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:gap-10">
                            {/* 0. Manual AI Prompt Bot (Task Bot) */}
                            <div className="bg-gradient-to-br from-blue-500/10 via-background to-background border-2 border-blue-500/20 p-5 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden group/taskbot">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/taskbot:opacity-20 transition-opacity">
                                    <Bot className="w-32 h-32 text-blue-500" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4 md:mb-6">
                                        <div className="bg-blue-500 text-white p-2.5 md:p-3 rounded-2xl shadow-lg shadow-blue-500/30">
                                            <Bot className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight text-foreground">Manuálny AI Agent</h3>
                                    </div>

                                    <p className="text-muted-foreground font-medium text-sm md:text-lg leading-relaxed mb-6 max-w-2xl">
                                        Zadajte vlastnú tému alebo prompt a AI asistent vytvorí kompletný článok na mieru.
                                    </p>

                                    <div className="space-y-6 bg-background/50 border border-border/50 p-6 md:p-8 rounded-[32px] backdrop-blur-sm shadow-inner mt-4">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <MessageSquare className="w-4 h-4 text-blue-500" />
                                                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground block">Čo má AI urobiť? (Zadanie)</label>
                                            </div>
                                            <textarea
                                                value={customBotPrompt}
                                                onChange={(e) => setCustomBotPrompt(e.target.value)}
                                                placeholder="Napr.: Napíš detailnú analýzu o tom, ako Claude 3.7 mení programovanie..."
                                                className="w-full bg-background border-2 border-border/50 rounded-2xl p-4 md:p-6 text-sm font-medium focus:border-blue-500 focus:outline-none transition-all min-h-[120px] shadow-sm resize-none"
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 md:gap-10">
                                            {/* Switch Post to social */}
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Siete</span>
                                                    <span className="text-[9px] text-muted-foreground font-medium italic">Postovať na siete?</span>
                                                </div>
                                                <button
                                                    onClick={() => setCustomBotPostSocial(!customBotPostSocial)}
                                                    className={cn(
                                                        "w-12 h-6 rounded-full transition-all relative flex-shrink-0",
                                                        customBotPostSocial ? "bg-blue-500 shadow-md shadow-blue-500/20" : "bg-neutral-600"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                                        customBotPostSocial ? "left-7" : "left-1"
                                                    )} />
                                                </button>
                                            </div>

                                            {/* Publish directly or draft */}
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Status</span>
                                                    <span className="text-[9px] text-muted-foreground font-medium italic">Ihneď publikovať?</span>
                                                </div>
                                                <button
                                                    onClick={() => setCustomBotPublishStatus(customBotPublishStatus === 'published' ? 'draft' : 'published')}
                                                    className={cn(
                                                        "w-12 h-6 rounded-full transition-all relative flex-shrink-0",
                                                        customBotPublishStatus === 'published' ? "bg-green-500 shadow-md shadow-green-500/20" : "bg-neutral-600"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                                        customBotPublishStatus === 'published' ? "left-7" : "left-1"
                                                    )} />
                                                </button>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-[60px]">
                                                    {customBotPublishStatus === 'published' ? 'PUBLISH' : 'DRAFT'}
                                                </span>
                                            </div>

                                            <div className="ml-auto w-full md:w-auto">
                                                <button
                                                    onClick={handleManualCustomBotRun}
                                                    disabled={isCustomBotRunning || !customBotPrompt.trim()}
                                                    className="w-full md:w-auto bg-blue-600 text-white px-10 py-5 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                                >
                                                    <Zap className={cn("w-5 h-5", isCustomBotRunning && "animate-spin")} />
                                                    {isCustomBotRunning ? "Agent pracuje..." : "Spustiť agenta"}
                                                    {!isCustomBotRunning && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 1. Full Automation Bot (Post Publisher) - NOW AT THE TOP */}
                            <div className="bg-gradient-to-br from-indigo-500/10 via-background to-background border-2 border-indigo-500/20 p-5 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden group/agent">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/agent:opacity-20 transition-opacity">
                                    <Share2 className="w-32 h-32 text-indigo-500" />
                                </div>

                                <div className="relative z-10 flex flex-col lg:flex-row gap-6 md:gap-10">
                                    <div className="max-w-xl">
                                        <div className="flex items-center gap-3 mb-4 md:mb-6">
                                            <div className="bg-indigo-500 text-white p-2.5 md:p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
                                                <Share2 className="w-5 h-5 md:w-6 md:h-6" />
                                            </div>
                                            <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight text-foreground">Full Automation Bot</h3>
                                            {socialBotSettings.enabled ? (
                                                <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Aktívny</span>
                                            ) : (
                                                <span className="bg-muted text-muted-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Neaktívny</span>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground font-medium text-sm md:text-lg leading-relaxed mb-6">
                                            Autonómny agent, ktorý v určených časoch sám <strong className="text-foreground">objaví</strong> novinky, <strong className="text-foreground">napíše</strong> články a <strong className="text-foreground">publikuje</strong> ich na web aj sociálne siete.
                                        </p>

                                        {/* Bot Live Status Feed - Premium Countdown */}
                                        {socialBotSettings.enabled && (
                                            <div className="bg-indigo-500/10 border-2 border-indigo-500/20 rounded-3xl md:rounded-[32px] p-5 md:p-8 mb-8 md:mb-10 flex flex-col items-center justify-center relative overflow-hidden group/status">
                                                {/* Animated Background Pulse */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />

                                                <div className="relative z-10 flex flex-col items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/80">Najbližší chod o</span>
                                                    </div>

                                                    <div className="text-4xl md:text-7xl font-black tabular-nums tracking-tighter text-foreground flex items-baseline gap-2">
                                                        {isBotRunning ? (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <RefreshCw className="w-16 h-16 animate-spin text-indigo-500 mb-2" />
                                                                <span className="text-xl font-black uppercase tracking-[0.2em] text-indigo-500 animate-pulse">Prebieha automatizácia...</span>
                                                            </div>
                                                        ) : countdownToNext ? (
                                                            countdownToNext.split(' ').map((part, idx) => (
                                                                <span key={idx} className="flex items-baseline gap-1">
                                                                    {part.replace(/[a-z]/g, '')}
                                                                    <span className="text-base md:text-2xl text-indigo-500/40 font-black lowercase">{part.replace(/[0-9]/g, '')}</span>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xl md:text-2xl opacity-50 uppercase tracking-widest">Pripravujem...</span>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 flex flex-col items-center gap-1">
                                                        <div className="px-4 py-1.5 bg-background/50 backdrop-blur-md border border-white/5 rounded-full shadow-sm flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                                {socialBotSettings.last_run ? `Naposledy skontrolované: ${new Date(socialBotSettings.last_run).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}` : 'Čakám na prvý chod'}
                                                            </span>
                                                        </div>
                                                        {socialBotSettings.last_status && !socialBotSettings.last_status.includes('Čakám') && (
                                                            <p className="text-[9px] font-bold text-muted-foreground/60 italic mt-2 max-w-xs text-center truncate">
                                                                {socialBotSettings.last_status}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Category Selection for Bot */}
                                            <div className="space-y-4 md:col-span-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Globe className="w-4 h-4 text-indigo-500" />
                                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground block">Cieľové kategórie bota</label>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {["Novinky SK/CZ", "AI", "Tech", "Biznis", "Krypto", "Svet", "Politika", "Gaming"].map((cat) => {
                                                        const isSelected = socialBotSettings.target_categories?.includes(cat);
                                                        return (
                                                            <button
                                                                key={cat}
                                                                onClick={() => {
                                                                    const current = socialBotSettings.target_categories || [];
                                                                    const next = isSelected
                                                                        ? current.filter(c => c !== cat)
                                                                        : [...current, cat];
                                                                    handleSaveSocialBotSettings({ ...socialBotSettings, target_categories: next });
                                                                }}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                                                                    isSelected
                                                                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                                                        : "bg-background/40 text-muted-foreground border border-white/5 hover:border-indigo-500/30"
                                                                )}
                                                            >
                                                                {isSelected && <Check className="w-3 h-3" />}
                                                                {cat}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground block">Interval publikovania</label>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={socialBotSettings.interval_hours}
                                                            min="1"
                                                            max="168"
                                                            onChange={(e) => setSocialBotSettings({ ...socialBotSettings, interval_hours: parseInt(e.target.value) || 1 })}
                                                            onBlur={() => handleSaveSocialBotSettings(socialBotSettings)}
                                                            className="w-24 bg-background border-2 border-border rounded-xl px-4 py-3 text-center font-bold focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Hodín</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Clock className="w-4 h-4 text-indigo-500" />
                                                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground block">Presné časy</label>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {socialBotSettings.posting_times.map((time, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 bg-muted/30 hover:bg-muted/50 px-3.5 py-2 rounded-xl border border-border/50 group/time transition-all">
                                                            <span className="text-xs font-black tabular-nums">{time}</span>
                                                            <button
                                                                onClick={() => {
                                                                    const newTimes = socialBotSettings.posting_times.filter((_, i) => i !== idx);
                                                                    handleSaveSocialBotSettings({ ...socialBotSettings, posting_times: newTimes });
                                                                }}
                                                                className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover/time:opacity-100"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            const time = prompt("Zadajte čas publikovania (HH:MM):", "12:00");
                                                            if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                                                                handleSaveSocialBotSettings({ ...socialBotSettings, posting_times: [...socialBotSettings.posting_times, time].sort() });
                                                            } else if (time) {
                                                                alert("Neplatný formát času. Použite HH:MM (napr. 09:30 alebo 21:00)");
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-indigo-500/10 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all border-2 border-dashed border-indigo-500/30 flex items-center gap-2"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Pridať
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 min-w-[280px] lg:mt-auto">
                                        <div className="bg-background/40 backdrop-blur-md border border-white/10 p-6 rounded-[32px] space-y-4 shadow-xl ring-1 ring-black/5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Auto-Publish</span>
                                                    <span className="text-[9px] text-muted-foreground font-medium italic">Postovať hneď</span>
                                                </div>
                                                <button
                                                    onClick={() => handleSaveSocialBotSettings({ ...socialBotSettings, auto_publish: !socialBotSettings.auto_publish })}
                                                    className={cn(
                                                        "w-12 h-6 rounded-full transition-all relative flex-shrink-0",
                                                        socialBotSettings.auto_publish ? "bg-green-500 shadow-md shadow-green-500/20" : "bg-neutral-600"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                                        socialBotSettings.auto_publish ? "left-7" : "left-1"
                                                    )} />
                                                </button>
                                            </div>

                                            <button
                                                onClick={handleToggleSocialBot}
                                                disabled={status === "loading"}
                                                className={cn(
                                                    "w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 mt-2 shadow-lg transition-all active:scale-95",
                                                    socialBotSettings.enabled
                                                        ? "bg-neutral-800 text-white hover:bg-neutral-700"
                                                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30"
                                                )}
                                            >
                                                {socialBotSettings.enabled ? (
                                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Vypnúť Bota</>
                                                ) : (
                                                    <><Zap className="w-4 h-4 fill-current" /> Zapnúť Bota</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Manual Full Automation (Integrated Flow) */}
                            <div className="bg-gradient-to-br from-purple-500/10 via-background to-background border-2 border-purple-500/20 p-5 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden group/manual">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/manual:opacity-20 transition-opacity">
                                    <CloudLightning className="w-32 h-32 text-purple-500" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4 md:mb-6">
                                        <div className="bg-purple-500 text-white p-2.5 md:p-3 rounded-2xl shadow-lg">
                                            <CloudLightning className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight">Manuálna automatizácia</h3>
                                    </div>
                                    <p className="text-muted-foreground font-medium text-sm md:text-lg leading-relaxed mb-6 md:mb-8 max-w-2xl">
                                        Vyberte kategóriu a systém automaticky <strong className="text-foreground">vyhľadá</strong> nový článok, <strong className="text-foreground">vygeneruje</strong> ho v slovenčine a <strong className="text-foreground">publikuje</strong> ho spolu s príspevkami na sociálne siete.
                                    </p>

                                    <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-8 bg-background/50 border border-border/50 p-5 md:p-6 rounded-3xl backdrop-blur-sm">
                                        <div className="flex-grow w-full">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 ml-2">Cieľová kategória</label>
                                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                                                {["Novinky SK/CZ", "AI", "Tech", "Biznis", "Krypto", "Svet", "Politika", "Gaming"].map((cat) => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setSelectedFullAutomationCategory(cat)}
                                                        className={cn(
                                                            "px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border",
                                                            selectedFullAutomationCategory === cat
                                                                ? "bg-purple-500 text-white border-purple-500 shadow-md scale-105"
                                                                : "bg-background/80 border-border/50 text-muted-foreground hover:border-purple-500/40 hover:text-foreground"
                                                        )}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleFullAutomationSingle}
                                            disabled={isFullAutomationLoading}
                                            className="whitespace-nowrap bg-purple-600 text-white px-10 py-5 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
                                        >
                                            <Zap className={cn("w-5 h-5", isFullAutomationLoading && "animate-spin")} />
                                            {isFullAutomationLoading ? "Prebieha automatizácia..." : "Automatizovať 1 článok"}
                                            {!isFullAutomationLoading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 3. AI Autopilot (Article Generator) */}
                            <div className="bg-gradient-to-br from-primary/10 via-background to-background border-2 border-primary/20 p-5 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden group/auto">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover/auto:opacity-20 transition-opacity">
                                    <Sparkles className="w-32 h-32 text-primary" />
                                </div>

                                <div className="relative z-10 flex flex-col @[1000px]:flex-row gap-6 md:gap-10">
                                    <div className="max-w-xl">
                                        <div className="flex items-center gap-3 mb-4 md:mb-6">
                                            <div className="bg-primary text-primary-foreground p-2.5 md:p-3 rounded-2xl shadow-lg shadow-primary/30">
                                                <Zap className="w-5 h-5 md:w-6 md:h-6" />
                                            </div>
                                            <h3 className="text-xl md:text-3xl font-black uppercase tracking-tight">AI Autopilot</h3>
                                            {autopilotSettings.enabled ? (
                                                <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Aktívny</span>
                                            ) : (
                                                <span className="bg-muted text-muted-foreground text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Vypnutý</span>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground font-medium text-sm md:text-lg leading-relaxed mb-6">
                                            <strong className="text-foreground">Každú hodinu</strong> automaticky vyhľadá najlepšie svetové trendy, spracuje ich a publikuje priamo na web.
                                        </p>

                                        {/* Autopilot Live Status Feed - Premium Countdown */}
                                        {autopilotSettings.enabled && (
                                            <div className="bg-primary/10 border-2 border-primary/20 rounded-3xl md:rounded-[32px] p-5 md:p-8 mb-8 md:mb-10 flex flex-col items-center justify-center relative overflow-hidden group/status">
                                                {/* Animated Background Pulse */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

                                                <div className="relative z-10 flex flex-col items-center gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 bg-primary rounded-full animate-ping" />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Najbližší chod o</span>
                                                    </div>

                                                    <div className="text-4xl md:text-7xl font-black tabular-nums tracking-tighter text-foreground flex items-baseline gap-2">
                                                        {isAutopilotManualRunning ? (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <RefreshCw className="w-12 h-12 md:w-16 md:h-16 animate-spin text-primary mb-2" />
                                                                <span className="text-sm md:text-xl font-black uppercase tracking-[0.2em] text-primary animate-pulse">Prebieha automatizácia...</span>
                                                            </div>
                                                        ) : countdownAutopilot ? (
                                                            countdownAutopilot.split(' ').map((part, idx) => (
                                                                <span key={idx} className="flex items-baseline gap-1">
                                                                    {part.replace(/[a-z]/g, '')}
                                                                    <span className="text-base md:text-2xl text-primary/40 font-black lowercase">{part.replace(/[0-9]/g, '')}</span>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xl md:text-2xl opacity-50 uppercase tracking-widest">Pripravujem...</span>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 flex flex-col items-center gap-1">
                                                        <div className="px-4 py-1.5 bg-background/50 backdrop-blur-md border border-white/5 rounded-full shadow-sm flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                                {autopilotSettings.last_run ? `Naposledy bežalo: ${new Date(autopilotSettings.last_run).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}` : 'Čakám na prvý chod'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-6 text-sm font-bold uppercase tracking-widest">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground text-[10px] mb-1">Celkový status</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-foreground">Spracovaných: {autopilotSettings.processed_count}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={handleOpenAutopilotHistory}
                                                            className="p-1 hover:bg-primary/10 rounded transition-colors text-primary"
                                                            title="História"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={handleResetAutopilotCount}
                                                            className="p-1 hover:bg-red-500/10 rounded transition-colors text-muted-foreground hover:text-red-500"
                                                            title="Vynulovať počítadlo"
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 min-w-[240px] lg:justify-center">
                                        <button
                                            onClick={handleToggleAutopilot}
                                            disabled={status === "loading" && isAutopilotLoadingModalOpen}
                                            className={cn(
                                                "w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl",
                                                autopilotSettings.enabled
                                                    ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
                                                    : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                                            )}
                                        >
                                            {autopilotSettings.enabled ? "Vypnúť Autopilota" : "Zapnúť Autopilota"}
                                        </button>
                                        <button
                                            onClick={executeAutopilotRun}
                                            disabled={isAutopilotManualRunning || !autopilotSettings.enabled}
                                            className="w-full py-5 bg-primary text-primary-foreground hover:opacity-90 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                                        >
                                            <Zap className="w-4 h-4" />
                                            Spustiť manuálne
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MANAGE TAB */}
                {activeTab === "manage" && (
                    <div className="space-y-12 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-10 md:space-y-12">
                            {/* DRAFTS */}
                            <div>
                                <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest mb-6 md:mb-10 flex items-center gap-4">
                                    <span className="w-3 h-10 bg-yellow-500 rounded-full"></span> Koncepty (DRAFT)
                                    <span className="text-[10px] md:text-sm bg-muted px-3 py-1 rounded-full text-muted-foreground ml-auto">{articles.filter(a => a.status === 'draft').length}</span>
                                </h3>
                                {loadingArticles ? <div className="p-10 md:p-20 text-center animate-pulse font-black uppercase tracking-widest text-muted-foreground text-xs md:text-base">Načítavam...</div> :
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                                        {articles.filter(a => a.status === 'draft').map((article) => (
                                            <div key={article.id} className="bg-card border rounded-3xl md:rounded-[32px] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-xl transition-all ring-1 ring-border/50">
                                                <div className="relative w-full h-44 border-b overflow-hidden">
                                                    {article.main_image && (
                                                        <Image
                                                            src={article.main_image}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                </div>
                                                <div className="p-6 flex-grow">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary mb-5 block">{article.category}</span>
                                                    <h4 className="text-lg font-black leading-tight mb-3 line-clamp-2">{article.title}</h4>
                                                    <p className="text-sm text-muted-foreground line-clamp-3 font-medium">{article.excerpt}</p>
                                                </div>
                                                <div className="p-6 pt-0 mt-auto flex flex-wrap gap-2">
                                                    <Link
                                                        href={`/article/${article.slug}?preview=make-com-webhook-secret`}
                                                        target="_blank"
                                                        className="flex-1 min-w-[80px] bg-muted hover:bg-primary/10 hover:text-primary p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-primary/20"
                                                    >
                                                        Náhľad
                                                    </Link>
                                                    <Link href={`/admin/edit/${article.id}`} className="flex-1 min-w-[80px] bg-muted hover:bg-primary/10 hover:text-primary p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-primary/20">Upraviť</Link>
                                                    <button onClick={() => handlePublish(article.id, article.status)} className="flex-1 min-w-[100px] bg-green-500 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-green-500/20">Publikovať</button>
                                                    <button onClick={() => handleDelete(article.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {articles.filter(a => a.status === 'draft').length === 0 && <div className="col-span-full p-20 text-center border-2 border-dashed rounded-[32px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">Žiadne koncepty</div>}
                                    </div>
                                }
                            </div>

                            {/* PUBLISHED */}
                            <div className="pt-8 border-t border-border/50">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <h3 className="text-2xl font-black uppercase tracking-widest flex items-center gap-4 text-foreground/70">
                                        <span className="w-3 h-10 bg-green-500 rounded-full opacity-50"></span> Online na webe
                                        <span className="text-sm bg-muted px-3 py-1 rounded-full text-muted-foreground ml-2">{articles.filter(a => a.status === 'published').length}</span>
                                    </h3>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRefreshRecentCategories}
                                            disabled={refreshingType !== "none"}
                                            className="bg-zinc-800/80 text-zinc-100 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center gap-2 border border-white/10"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", refreshingType === "recent" && "animate-spin")} />
                                            AI opraviť 20
                                        </button>
                                        <button
                                            onClick={handleRefreshAllCategories}
                                            disabled={refreshingType !== "none"}
                                            className="bg-red-500/15 text-red-400 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/25 transition-all flex items-center gap-2 border border-red-500/30"
                                        >
                                            <RefreshCw className={cn("w-3.5 h-3.5", refreshingType === "all" && "animate-spin")} />
                                            AI opraviť VŠETKO
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsBulkCategoryMode(!isBulkCategoryMode);
                                                setBulkSelectedArticles([]);
                                            }}
                                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${isBulkCategoryMode
                                                ? "bg-white text-black hover:bg-zinc-200 border-2 border-white"
                                                : "bg-primary text-primary-foreground border-2 border-primary/20 hover:scale-[1.02]"}`}
                                        >
                                            {isBulkCategoryMode ? "Zrušiť hromadnú úpravu" : "Hromadná oprava kategórií"}
                                        </button>
                                    </div>
                                </div>

                                {isBulkCategoryMode && (
                                    <div className="w-full bg-zinc-900/90 border border-white/10 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 mb-10 shadow-2xl ring-1 ring-white/5 animate-in slide-in-from-top-4 duration-300">
                                        <div className="flex items-center gap-4 text-white">
                                            <div className="bg-primary/20 p-3 rounded-2xl">
                                                <RefreshCw className={`w-5 h-5 text-primary ${refreshingType === "bulk" ? "animate-spin" : ""}`} />
                                            </div>
                                            <span className="font-black text-sm uppercase tracking-widest">
                                                Vybraných článkov pre AI kontrolu: <span className="text-2xl ml-2 text-primary">{bulkSelectedArticles.length}</span>
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleRefreshCategories}
                                            disabled={bulkSelectedArticles.length === 0 || refreshingType !== "none"}
                                            className="w-full md:w-auto px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:scale-[1.05] active:scale-[0.95] transition-all shadow-2xl disabled:bg-zinc-800 disabled:text-zinc-600 disabled:opacity-100 disabled:cursor-not-allowed flex items-center gap-3 justify-center border border-white/10"
                                        >
                                            {refreshingType === "bulk" ? "AI ANALYZUJE..." : "SPUSTIŤ AI OPRAVU"}
                                        </button>
                                    </div>
                                )}

                                {/* Category Filter for Published Articles */}
                                {articles.filter(a => a.status === 'published').length > 0 && (
                                    <div className="flex flex-wrap gap-2 p-1.5 bg-muted/30 rounded-2xl w-fit border border-border/50 mb-8">
                                        <button
                                            onClick={() => setSelectedPublishedCategory("Všetky")}
                                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedPublishedCategory === "Všetky" ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}
                                        >
                                            Všetky ({articles.filter(a => a.status === 'published').length})
                                        </button>
                                        {Array.from(new Set(articles.filter(a => a.status === 'published').map(a => a.category || "Nezaradené"))).map(cat => {
                                            const count = articles.filter(a => a.status === 'published' && (a.category || "Nezaradené") === cat).length;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedPublishedCategory(cat)}
                                                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedPublishedCategory === cat ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"}`}
                                                >
                                                    {cat} ({count})
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {articles.filter(a => a.status === 'published' && (selectedPublishedCategory === "Všetky" || (a.category || "Nezaradené") === selectedPublishedCategory)).map((article) => (
                                        <div key={article.id} className="relative group/admin">
                                            <div className={isBulkCategoryMode ? "pointer-events-none" : ""}>
                                                <ArticleCard article={article} />
                                            </div>

                                            {isBulkCategoryMode && (
                                                <div
                                                    onClick={() => toggleBulkSelection(article.id)}
                                                    className={`absolute inset-0 z-40 rounded-[2rem] cursor-pointer transition-all ${bulkSelectedArticles.includes(article.id)
                                                        ? "bg-primary/20 ring-4 ring-inset ring-primary"
                                                        : "bg-black/50 hover:bg-black/30"
                                                        }`}
                                                >
                                                    {bulkSelectedArticles.includes(article.id) && (
                                                        <div className="absolute top-6 right-6 bg-primary text-white p-2 rounded-full shadow-2xl shadow-black">
                                                            <CheckCircle2 className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Admin Overlay Actions */}
                                            {!isBulkCategoryMode && (
                                                <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 opacity-0 group-hover/admin:opacity-100 transition-opacity duration-300">
                                                    <Link
                                                        href={`/admin/edit/${article.id}`}
                                                        className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <Edit className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handlePublish(article.id, article.status)}
                                                        title="Stiahnuť z webu (Zmeniť na DRAFT)"
                                                        className="p-3 bg-white/20 hover:bg-yellow-500/80 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <ArrowDown className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(article.id)}
                                                        title="Zmazať navždy"
                                                        className="p-3 bg-white/20 hover:bg-red-500/90 backdrop-blur-md rounded-full text-white transition-all border border-white/20 shadow-2xl flex items-center gap-2 group/btn"
                                                    >
                                                        <Trash2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {articles.filter(a => a.status === 'published').length === 0 && (
                                        <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[32px] text-muted-foreground font-bold uppercase tracking-widest opacity-30 italic">
                                            Zatiaľ žiadne články vonku
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "analytics" && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="bg-card border rounded-[32px] p-6 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Zap className="w-12 h-12" />
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground mb-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Dnes videní</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.todayVisits.toLocaleString('sk-SK')}</div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Kliknutia za posledných 24h</div>
                            </div>

                            <div className="bg-card border rounded-[32px] p-6 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Sparkles className="w-12 h-12" />
                                </div>
                                <div className="flex items-center gap-3 text-muted-foreground mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Dnes unikátov</span>
                                </div>
                                <div className="text-3xl font-black">{analytics.todayUnique.toLocaleString('sk-SK')}</div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Noví ľudia na webe dnes</div>
                            </div>

                            <div className="bg-card border rounded-[32px] p-6 shadow-sm flex flex-col gap-2 bg-muted/20">
                                <div className="flex items-center gap-3 text-muted-foreground mb-1">
                                    <Users className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Celkovo videní</span>
                                </div>
                                <div className="text-3xl font-black opacity-60">{analytics.totalVisits.toLocaleString('sk-SK')}</div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">História od začiatku</div>
                            </div>

                            <div className="bg-card border rounded-[32px] p-6 shadow-sm flex flex-col gap-2 bg-muted/20">
                                <div className="flex items-center gap-3 text-muted-foreground mb-1">
                                    <BarChart3 className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Celkovo unikátov</span>
                                </div>
                                <div className="text-3xl font-black opacity-60">{analytics.uniqueVisitors.toLocaleString('sk-SK')}</div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Unikátne identity v DB</div>
                            </div>

                            <button
                                onClick={fetchAnalytics}
                                disabled={loadingAnalytics}
                                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-[32px] p-6 flex flex-col items-center justify-center gap-2 transition-all group lg:col-span-1"
                            >
                                <RefreshCw className={cn("w-6 h-6", loadingAnalytics && "animate-spin")} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-center">Aktualizovať</span>
                            </button>
                        </div>

                        {/* Activity Graph */}
                        <div className="bg-card border rounded-[40px] p-8 md:p-10 shadow-sm relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Aktivita (posledných 30 dní)</h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Trendy návštevnosti a unikátnych používateľov</p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Zobrazenia</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary/30" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Unikáty</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[280px] w-full flex items-end gap-1 md:gap-1.5 px-2">
                                {analytics.dailyStats.length === 0 ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-50">
                                        <BarChart3 className="w-12 h-12" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Generujem dáta grafu...</p>
                                    </div>
                                ) : (
                                    analytics.dailyStats.map((day, i) => {
                                        const maxVisits = Math.max(...analytics.dailyStats.map(d => d.visits), 5);
                                        const heightPercent = (day.visits / maxVisits) * 100;

                                        return (
                                            <div key={day.date} className="flex-grow flex flex-col items-center group relative cursor-crosshair">
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-black p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none shadow-2xl scale-90 group-hover:scale-100 border border-white/10">
                                                    <div className="mb-2 text-primary-foreground/50 border-b border-primary-foreground/10 pb-1">
                                                        {new Date(day.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4 mt-1">
                                                        <span>Zobrazenia:</span>
                                                        <span className="text-primary-foreground">{day.visits}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span>Unikáty:</span>
                                                        <span className="text-primary-foreground/70">{day.unique}</span>
                                                    </div>
                                                </div>

                                                <div className="w-full flex items-end justify-center relative h-[220px]">
                                                    {/* Background Track (Visual aid) */}
                                                    <div className="absolute inset-0 w-full flex justify-center opacity-[0.02] bg-foreground rounded-t-lg" />

                                                    {/* Visits Bar */}
                                                    <div
                                                        className="w-full max-w-[14px] md:max-w-[24px] bg-primary/20 rounded-t-md relative flex items-end group-hover:bg-primary/30 transition-all duration-300"
                                                        style={{ height: `${heightPercent}%` }}
                                                    >
                                                        {/* Unique Bar (inner overlay) */}
                                                        <div
                                                            className="w-full bg-primary rounded-t-md shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)] transition-all group-hover:brightness-110"
                                                            style={{ height: `${(day.unique / (day.visits || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Date label (every 5th day or last day) */}
                                                {(i % 5 === 0 || i === analytics.dailyStats.length - 1) && (
                                                    <div className="absolute -bottom-8 flex flex-col items-center">
                                                        <div className="w-1 h-1 bg-border rounded-full mb-1" />
                                                        <span className="text-[8px] font-black opacity-30 uppercase tracking-tighter whitespace-nowrap">
                                                            {new Date(day.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <div className="mt-12" /> {/* Spacer for labels */}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Top Pages Table */}
                            <div className="bg-card border rounded-[40px] p-10 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Najčítanejšie stránky</h3>
                                <div className="space-y-4">
                                    {analytics.topPages.map((page, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                                            <span className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{page.path === '/' ? 'Domovská stránka' : page.path}</span>
                                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-black">{page.count} videní</span>
                                        </div>
                                    ))}
                                    {analytics.topPages.length === 0 && <p className="text-center text-muted-foreground py-10 font-medium">Zatiaľ žiadne dáta o návštevách.</p>}
                                </div>
                            </div>

                            {/* Geo Traffic */}
                            <div className="bg-card border rounded-[40px] p-10 shadow-sm">
                                <h3 className="text-xl font-black uppercase tracking-tight mb-8 px-2 flex items-center gap-3">
                                    <Globe className="w-6 h-6 text-primary" />
                                    Geografia (Krajiny)
                                </h3>
                                <div className="space-y-4">
                                    {analytics.countries.map((c, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{c.name === 'SK' ? '🇸🇰' : c.name === 'CZ' ? '🇨🇿' : c.name === 'US' ? '🇺🇸' : '🌍'}</span>
                                                <span className="text-sm font-bold uppercase tracking-widest">{c.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                                                    <div className="h-full bg-primary" style={{ width: `${(c.count / (analytics.totalVisits || 1)) * 100}%` }}></div>
                                                </div>
                                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-black">{c.count}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {analytics.countries.length === 0 && <p className="text-center text-muted-foreground py-10 font-medium italic opacity-50">Čakám na prvé geo-dáta...</p>}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Device Breakdown */}
                            <div className="bg-card border rounded-[40px] p-8 shadow-sm">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-muted-foreground">Zariadenia</h4>
                                <div className="space-y-4">
                                    {analytics.devices.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {d.name === 'mobile' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                                                <span className="text-[10px] font-bold uppercase">{d.name}</span>
                                            </div>
                                            <span className="text-[10px] font-black">{Math.round((d.count / (analytics.totalVisits || 1)) * 100)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Browser Breakdown */}
                            <div className="bg-card border rounded-[40px] p-8 shadow-sm">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-muted-foreground">Prehliadače</h4>
                                <div className="space-y-4">
                                    {analytics.browsers.map((b, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase">{b.name}</span>
                                            <span className="text-[10px] font-black">{b.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Visitor ID stats - Optional additional info */}
                            <div className="bg-card border rounded-[40px] p-8 shadow-sm flex flex-col justify-center items-center text-center">
                                <div className="text-2xl font-black mb-1">{analytics.uniqueVisitors}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unikátnych identít</div>
                                <p className="text-[10px] mt-4 leading-relaxed opacity-60 font-medium italic">Presné meranie bez cookies tretích strán.</p>
                            </div>
                        </div>

                        {/* Newsletter Subscribers Section */}
                        <div className="bg-card border rounded-[40px] p-10 shadow-sm overflow-hidden transition-all duration-500">
                            <button
                                onClick={() => setIsNewsletterOpen(!isNewsletterOpen)}
                                className="w-full flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-xl font-black uppercase tracking-tight">Odberatelia Newsletteru</h3>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Celkom {analytics.newsletterSubscribers.length} prihlásených e-mailov</p>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    {isNewsletterOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                            </button>

                            {isNewsletterOpen && (
                                <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {analytics.newsletterSubscribers.map((sub, idx) => (
                                            <div key={idx} className="bg-muted/10 border border-border/40 p-5 rounded-3xl flex flex-col gap-2 hover:bg-muted/20 transition-all group">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Email</span>
                                                    <button
                                                        onClick={() => copyToClipboard(sub.email)}
                                                        className="p-1.5 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="text-sm font-bold truncate">{sub.email}</div>
                                                <div className="mt-2 pt-2 border-t border-border/20 flex items-center justify-between">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Prihlásený</span>
                                                    <span className="text-[10px] font-bold">{new Date(sub.updated_at).toLocaleDateString('sk-SK')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {analytics.newsletterSubscribers.length === 0 && (
                                        <div className="text-center py-10 text-muted-foreground font-bold uppercase tracking-widest opacity-50 italic">
                                            Zatiaľ žiadni odberatelia
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-card border rounded-[40px] p-10 shadow-sm">
                            <h3 className="text-xl font-black uppercase tracking-tight mb-8">Posledná aktivita</h3>
                            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-4 custom-scrollbar">
                                {analytics.recentVisits.map((visit, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-muted/10 hover:bg-muted/20 rounded-[24px] border border-border/40 transition-all group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/50 group-hover:scale-110 transition-transform flex-shrink-0">
                                                {visit.device === 'mobile' ? <Smartphone size={14} /> : <Monitor size={14} />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-primary font-black text-[10px] uppercase tracking-wider">{visit.path === '/' ? 'HOME' : visit.path}</span>
                                                    <span className="text-muted-foreground text-[10px]">•</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground">{visit.country || '??'} ({visit.city || '?'})</span>
                                                </div>
                                                <div className="text-[11px] font-medium text-muted-foreground truncate opacity-70">
                                                    {visit.browser} na {visit.os} • Ref: {visit.referrer || 'Priamy prístup'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                                                {new Date(visit.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-[9px] font-bold text-primary/60">
                                                {new Date(visit.created_at).toLocaleDateString('sk-SK')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {analytics.recentVisits.length === 0 && <p className="text-center text-muted-foreground py-10 font-medium">Zatiaľ žiadne dáta o návštevách.</p>}
                            </div>
                        </div>

                    </div>
                )}

                {
                    activeTab === "social" && (
                        <div className="space-y-10 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Header & Platform Selection */}
                            <div className="bg-card border rounded-3xl md:rounded-[40px] p-6 md:p-10 shadow-sm ring-1 ring-border/50">
                                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-8 flex items-center gap-4">
                                    <Share2 className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                                    Social Media Studio
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
                                    {[
                                        { id: "Instagram", icon: Instagram, color: "text-pink-500" },
                                        { id: "Facebook", icon: Facebook, color: "text-blue-600" },
                                        { id: "X", icon: XIcon, color: "text-foreground" }
                                    ].map((p) => {
                                        const isSelected = socialPlatforms.includes(p.id as SocialPost['platform']);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setSocialPlatforms(prev =>
                                                        isSelected
                                                            ? prev.filter(id => id !== p.id)
                                                            : [...prev, p.id as SocialPost['platform']]
                                                    );
                                                }}
                                                className={cn(
                                                    "flex items-center justify-center gap-4 p-6 rounded-[24px] border-2 transition-all font-black uppercase tracking-widest text-sm",
                                                    isSelected
                                                        ? "bg-foreground text-background border-foreground shadow-xl scale-[1.02]"
                                                        : "bg-background border-border/50 text-muted-foreground hover:border-primary/30"
                                                )}
                                            >
                                                <p.icon className={cn("w-6 h-6", isSelected ? "text-background" : p.color)} />
                                                {p.id}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={handleGenerateSocialPosts}
                                    disabled={socialSelectedArticles.length === 0 || socialPlatforms.length === 0 || isGeneratingSocial}
                                    className="w-full bg-foreground text-background py-6 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                                >
                                    {isGeneratingSocial ? "Generujem príspevky..." : `Generovať príspevky pre články (${socialSelectedArticles.length})`}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                                {/* Article Selection - Takes 5/12 columns */}
                                <div className="lg:col-span-5 bg-[#121212] border border-white/[0.03] rounded-[40px] p-8 md:p-10 shadow-2xl h-fit border-t-white/[0.08] relative">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Vyberte články</h3>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Základ pre AI generovanie</p>
                                        </div>
                                        {socialSelectedArticles.length > 0 && (
                                            <div className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-2xl animate-in zoom-in-95 duration-300">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                                    {socialSelectedArticles.length} vybrané
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative mb-6">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Hľadať v správach..."
                                            value={socialArticleSearch}
                                            onChange={(e) => setSocialArticleSearch(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 rounded-[20px] border border-white/[0.05] bg-white/[0.02] text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all focus:bg-white/[0.05]"
                                        />
                                    </div>

                                    <div className="space-y-4 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
                                        {(() => {
                                            const q = socialArticleSearch.trim().toLowerCase();
                                            const filtered = q
                                                ? articles.filter((a) =>
                                                    a.title.toLowerCase().includes(q) ||
                                                    (a.category?.toLowerCase().includes(q) ?? false)
                                                )
                                                : articles;
                                            const toShow = filtered.slice(0, 50);
                                            if (toShow.length === 0) {
                                                return (
                                                    <div className="py-20 text-center bg-white/[0.01] rounded-[32px] border border-dashed border-white/5">
                                                        <Search className="w-10 h-10 mx-auto mb-4 opacity-10" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                                                            Nič sme nenašli
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return toShow.map((article) => {
                                                const isSelected = socialSelectedArticles.includes(article.id);
                                                return (
                                                    <div
                                                        key={article.id}
                                                        onClick={() => setSocialSelectedArticles(prev =>
                                                            isSelected ? prev.filter(id => id !== article.id) : [...prev, article.id]
                                                        )}
                                                        className={cn(
                                                            "group relative overflow-hidden rounded-[24px] border transition-all flex items-center gap-4 p-4 cursor-pointer active:scale-[0.98]",
                                                            isSelected
                                                                ? "bg-primary/[0.08] border-primary/30 shadow-lg shadow-primary/5"
                                                                : "bg-white/[0.01] border-white/[0.03] hover:border-white/10 hover:bg-white/[0.03]"
                                                        )}
                                                    >
                                                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl ring-1 ring-white/10">
                                                            <Image
                                                                src={article.main_image}
                                                                alt={article.title}
                                                                fill
                                                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                            />
                                                        </div>

                                                        <div className="flex-grow min-w-0 pr-2">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                                                                    {article.category}
                                                                </span>
                                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                    {new Date(article.published_at).toLocaleDateString('sk-SK')}
                                                                </span>
                                                            </div>
                                                            <h4 className="text-sm font-black leading-tight line-clamp-2 text-white group-hover:text-primary transition-colors">
                                                                {article.title}
                                                            </h4>
                                                        </div>

                                                        <div className={cn(
                                                            "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 shadow-lg",
                                                            isSelected
                                                                ? "bg-primary border-primary text-white"
                                                                : "border-white/10 bg-black/40 text-white/10 group-hover:border-primary/40 group-hover:text-primary/40"
                                                        )}>
                                                            {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Generated Content Preview - Sticky (Takes 7/12 columns) */}
                                <div className="lg:col-span-7 space-y-8 lg:sticky lg:top-24">
                                    <div className="flex items-center justify-between px-2">
                                        <div>
                                            <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Náhľady príspevkov</h3>
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Kontrola výstupov pred publikáciou</p>
                                        </div>
                                    </div>

                                    {socialSelectedArticles.length === 0 ? (
                                        <div className="bg-[#121212] border border-dashed border-white/5 rounded-[40px] p-24 text-center">
                                            <div className="w-20 h-20 bg-white/[0.02] rounded-full flex items-center justify-center mx-auto mb-6 scale-animation">
                                                <Sparkles className="w-10 h-10 text-primary opacity-20" />
                                            </div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">
                                                Čakáme na výber článkov
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-3 custom-scrollbar">
                                            {socialSelectedArticles.map((articleId) => {
                                                const article = articles.find(a => a.id === articleId);
                                                const result = socialResults[articleId];
                                                if (!article) return null;

                                                return (
                                                    <div key={articleId} className="bg-[#121212] border border-white/[0.05] rounded-[32px] p-8 shadow-2xl animate-in fade-in slide-in-from-right-4 relative overflow-hidden group">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/[0.03]">
                                                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                                                                <img src={article.main_image} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="text-[9px] font-black text-primary uppercase tracking-widest block mb-1">{article.category}</span>
                                                                <h4 className="text-sm font-black text-white truncate">{article.title}</h4>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-10">
                                                            {socialPlatforms.map((platform) => {
                                                                const platformResult = result?.[platform];
                                                                return (
                                                                    <div key={platform} className="animate-in fade-in slide-in-from-bottom-2">
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={cn(
                                                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg",
                                                                                    platform === 'Instagram' ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" :
                                                                                        platform === 'Facebook' ? "bg-[#1877F2]" : "bg-black border border-white/10"
                                                                                )}>
                                                                                    {platform === "Instagram" && <Instagram size={14} />}
                                                                                    {platform === "Facebook" && <Facebook size={14} />}
                                                                                    {platform === "X" && <XIcon size={14} />}
                                                                                </div>
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{platform} príspevok</span>
                                                                            </div>
                                                                            {platformResult && (
                                                                                <button
                                                                                    onClick={() => copyToClipboard(platformResult)}
                                                                                    className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] hover:bg-primary/10 hover:text-primary rounded-xl transition-all text-[9px] font-black uppercase tracking-widest border border-white/5 active:scale-95"
                                                                                >
                                                                                    <Copy className="w-3.5 h-3.5" />
                                                                                    Kopírovať
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {platformResult ? (
                                                                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative group transition-colors hover:bg-white/[0.04]">
                                                                                <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium text-zinc-300">
                                                                                    {platformResult}
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="bg-white/[0.02] border border-dashed border-white/5 rounded-2xl p-8 text-center text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">
                                                                                {isGeneratingSocial ? (
                                                                                    <div className="flex items-center justify-center gap-3">
                                                                                        <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                                                                                        <span>AI pripravuje...</span>
                                                                                    </div>
                                                                                ) : "Čaká na vygenerovanie"}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {/* Image Generator Preview - Integrated into card */}
                                                            <div className="mt-10 pt-8 border-t border-white/[0.03]">
                                                                <InstagramPreview
                                                                    title={article.title}
                                                                    articleImage={article.main_image}
                                                                    category={article.category}
                                                                    summary={article.ai_summary}
                                                                    date={article.published_at}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Social Media Planner Section */}
                            <div className="bg-[#0a0a0a] border border-white/[0.03] rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                                {/* Header Row: Title & Action Buttons */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
                                    <h3 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[24px] bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] ring-1 ring-primary/20">
                                            <Calendar className="w-8 h-8" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="leading-none text-white">AI Planner &</span>
                                            <span className="leading-none text-zinc-500 mt-1">História postov</span>
                                        </div>
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={handleSocialAutopilot}
                                            disabled={isSocialAutopilotGenerating}
                                            className="h-12 flex items-center gap-3 px-6 bg-white text-black rounded-2xl transition-all hover:bg-zinc-200 active:scale-95 shadow-xl shadow-white/5 disabled:opacity-50 group"
                                        >
                                            <Sparkles className={cn("w-4 h-4 text-primary", isSocialAutopilotGenerating && "animate-pulse")} />
                                            <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                                                {isSocialAutopilotGenerating ? "Analyzujem..." : "AI Automatizátor"}
                                            </span>
                                        </button>

                                        <div className="h-12 w-[1px] bg-white/[0.05] mx-1 hidden md:block" />

                                        <button
                                            onClick={() => setIsPlannerOpen(!isPlannerOpen)}
                                            className={cn(
                                                "h-12 flex items-center gap-3 px-6 rounded-2xl transition-all border active:scale-95 shadow-lg",
                                                isPlannerOpen
                                                    ? "bg-white/[0.05] border-white/[0.1] text-white hover:bg-white/[0.1]"
                                                    : "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                                            )}
                                        >
                                            {isPlannerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                {isPlannerOpen ? 'Zabaliť' : 'Rozbaliť'}
                                            </span>
                                        </button>

                                        <button
                                            onClick={fetchPlannedPosts}
                                            className="h-12 w-12 flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white rounded-2xl transition-all border border-white/[0.05] group active:scale-95 shadow-lg"
                                            title="Obnoviť posty"
                                        >
                                            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                                        </button>

                                        <button
                                            onClick={handleDeleteAllSocialPosts}
                                            className="h-12 flex items-center gap-3 px-5 bg-red-500/5 text-red-500 rounded-2xl transition-all border border-red-500/10 hover:bg-red-500/10 hover:border-red-500/30 active:scale-95 shadow-lg"
                                            title="Vymazať všetko"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Vymazať</span>
                                        </button>
                                    </div>
                                </div >

                                {isPlannerOpen && (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                        {/* Header Row 2: Category Filters */}
                                        <div className="mb-10 p-2 bg-muted/30 rounded-[28px] border border-border/50">
                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 px-2">
                                                {['all', 'AI', 'Tech', 'Biznis', 'Krypto', 'Svet', 'Politika', 'Veda', 'Gaming', 'Návody & Tipy'].map((cat) => (
                                                    <button
                                                        key={cat}
                                                        onClick={() => setPlannedCategoryFilter(cat)}
                                                        className={cn(
                                                            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 border-transparent",
                                                            plannedCategoryFilter === cat
                                                                ? "bg-foreground text-background shadow-xl scale-105"
                                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                        )}
                                                    >
                                                        {cat === 'all' ? 'Všetky Príspevky' : cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {plannedPosts.length === 0 ? (
                                                <div className="py-20 text-center border-2 border-dashed rounded-[32px] text-muted-foreground">
                                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p className="font-bold uppercase text-xs tracking-widest">Zatiaľ žiadne naplánované príspevky</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-6 md:gap-8 lg:gap-10">
                                                    {(() => {
                                                        const grouped: Record<string, typeof plannedPosts> = {};
                                                        const filteredPosts = plannedCategoryFilter === 'all'
                                                            ? plannedPosts
                                                            : plannedPosts.filter(p => p.articles?.category === plannedCategoryFilter);

                                                        filteredPosts.forEach(post => {
                                                            const id = post.article_id || 'unknown';
                                                            if (!grouped[id]) grouped[id] = [];
                                                            grouped[id].push(post);
                                                        });

                                                        const groups = Object.entries(grouped);

                                                        if (groups.length === 0) {
                                                            return (
                                                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.02]">
                                                                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                                                    <p className="font-black uppercase text-[10px] tracking-[0.3em] opacity-40">Túto kategóriu ešte boti neobjavili</p>
                                                                </div>
                                                            );
                                                        }

                                                        return groups.map(([articleId, posts]) => {
                                                            const firstPost = posts[0];
                                                            const articleTitle = firstPost.articles?.title || "Neznámy článok";
                                                            const articleCategory = firstPost.articles?.category || "Novinka";
                                                            const articleImage = firstPost.articles?.main_image;

                                                            return (
                                                                <div key={articleId} className="group relative bg-[#121212] border border-white/[0.03] rounded-[32px] md:rounded-[40px] overflow-hidden transition-all duration-500 hover:bg-[#151515] hover:border-primary/20 flex flex-col md:flex-row shadow-2xl">
                                                                    {/* Thumbnail Section */}
                                                                    <div className="w-full h-56 md:w-64 lg:w-72 md:h-auto relative overflow-hidden bg-muted/10 flex-shrink-0">
                                                                        {articleImage ? (
                                                                            <img
                                                                                src={articleImage}
                                                                                alt={articleTitle}
                                                                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                                                                                <ImageIcon className="w-10 h-10 opacity-5" />
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute top-5 left-5 z-10">
                                                                            <span className="px-3 py-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary shadow-2xl">
                                                                                {articleCategory}
                                                                            </span>
                                                                        </div>
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                                    </div>

                                                                    {/* Content Area Section */}
                                                                    <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center flex-grow min-w-0">
                                                                        <div className="flex items-center gap-3 mb-4">
                                                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                                                {['Instagram', 'Facebook', 'X'].filter(pform => posts.some(p => p.platform === pform)).map((pform, idx) => (
                                                                                    <div key={pform} className={cn(
                                                                                        "w-7 h-7 rounded-full border-2 border-[#121212] flex items-center justify-center text-white shadow-lg",
                                                                                        pform === 'Instagram' ? "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600" :
                                                                                            pform === 'Facebook' ? "bg-[#1877F2]" : "bg-black border border-white/10"
                                                                                    )} style={{ zIndex: 10 - idx }}>
                                                                                        {pform === 'Instagram' && <Instagram size={11} />}
                                                                                        {pform === 'Facebook' && <Facebook size={11} />}
                                                                                        {pform === 'X' && <XIcon size={11} />}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                                                                {posts.length} sociálne formáty
                                                                            </span>
                                                                        </div>

                                                                        <h4 className="text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight mb-5 group-hover:text-primary transition-colors line-clamp-2 md:line-clamp-3">
                                                                            {articleTitle}
                                                                        </h4>

                                                                        <div className="flex flex-wrap gap-2 mb-8">
                                                                            {posts.map(p => (
                                                                                <div key={p.id} className={cn(
                                                                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                                                                                    p.status === 'posted'
                                                                                        ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                                                                        : "bg-white/[0.03] text-zinc-500 border border-white/[0.05]"
                                                                                )}>
                                                                                    {p.platform === 'Instagram' && <Instagram size={10} />}
                                                                                    {p.platform === 'Facebook' && <Facebook size={10} />}
                                                                                    {p.platform === 'X' && <XIcon size={10} />}
                                                                                    <span>{p.platform}</span>
                                                                                    {p.status === 'posted' && <CheckCircle2 size={10} className="ml-1" />}
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-white/[0.03] mt-auto">
                                                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                                                <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] rounded-2xl border border-white/[0.03]">
                                                                                    <Clock className="w-3.5 h-3.5 text-primary opacity-50" />
                                                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                                                                        {firstPost.created_at ? new Date(firstPost.created_at).toLocaleDateString('sk-SK') : 'Dnes'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => setSelectedPlannerArticle(articleId)}
                                                                                className="w-full sm:w-auto bg-white text-black px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"
                                                                            >
                                                                                Rozbaliť možnosti
                                                                                <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                                }
                            </div >
                        </div >
                    )
                }
                {/* MODALS - Simplified & High Z-Index */}
                {
                    isDiscoveringModalOpen && typeof document !== "undefined" && createPortal(
                        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-xl"></div>
                            <div className="bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/10">
                                <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                                <div className="relative mb-10 text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10">
                                    <Search className="w-10 h-10 animate-pulse text-primary z-10" />
                                    <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10">AI Discovery</h3>
                                <div className="h-16 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium">
                                    {discoveryStage}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }

                {
                    isGeneratingModalOpen && typeof document !== "undefined" && createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-2xl"></div>
                            <div className="bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center relative overflow-hidden ring-1 ring-white/10">
                                <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                                <div className="relative mb-10">
                                    <div className="relative text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10 shadow-[0_0_50px_-12px_rgba(var(--primary),0.5)]">
                                        <Sparkles className="w-10 h-10 animate-pulse text-primary z-10" />
                                        <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                    </div>
                                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping -z-10 opacity-30"></div>
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10 tracking-[0.2em]">AI Studio</h3>
                                <div className="h-20 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium italic">
                                    {generatingStage}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }

                {
                    isAutopilotLoadingModalOpen && typeof document !== "undefined" && createPortal(
                        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-xl z-0"></div>
                            <div className="relative z-10 bg-card w-full max-w-sm border border-border/50 rounded-[40px] p-12 shadow-2xl flex flex-col items-center text-center overflow-hidden ring-1 ring-white/10">
                                <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                                <div className="relative mb-10 text-primary w-24 h-24 rounded-full flex flex-col items-center justify-center bg-primary/10">
                                    <Zap className="w-10 h-10 animate-pulse text-primary z-10" />
                                    <div className="absolute inset-0 border-[4px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-widest mb-4 z-10">AI Autopilot</h3>
                                <div className="h-16 flex items-center justify-center overflow-hidden z-10 w-full px-2 text-sm text-muted-foreground font-medium">
                                    {autopilotLoadingStage}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }

                {
                    isAutopilotHistoryOpen && typeof document !== "undefined" && createPortal(
                        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 md:p-8" style={{ pointerEvents: 'auto' }}>
                            {/* Raw Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/80 backdrop-blur-xl cursor-pointer"
                                style={{ zIndex: 0 }}
                                onClick={() => setIsAutopilotHistoryOpen(false)}
                            ></div>

                            {/* Raw Modal Content */}
                            <div
                                className="relative bg-[#121212] w-full max-w-3xl rounded-[32px] border border-[#2a2a2a] flex flex-col max-h-[85vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden"
                                style={{ zIndex: 10 }}
                            >

                                {/* Header */}
                                <div className="px-8 py-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1a1a1a] text-white">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[#2a2a2a] p-2 rounded-xl text-white">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-widest leading-none mb-1 text-white">História Autopilota</h3>
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Spracované a Publikované články</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsAutopilotHistoryOpen(false);
                                        }}
                                        className="p-3 bg-[#2a2a2a] hover:bg-red-500/20 hover:text-red-500 rounded-2xl transition-colors cursor-pointer text-zinc-300 pointer-events-auto"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Content Area */}
                                <div className="p-8 overflow-y-auto space-y-4 flex-grow w-full bg-[#121212] text-white">
                                    {loadingHistory ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
                                            <RefreshCw className="w-10 h-10 animate-spin text-white" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Načítavam dáta z databázy...</span>
                                        </div>
                                    ) : autopilotHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-[#2a2a2a] rounded-3xl mx-4">
                                            <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6">
                                                <History className="w-8 h-8 text-zinc-500" />
                                            </div>
                                            <h4 className="text-lg font-black uppercase tracking-widest text-white mb-2">Žiadna história</h4>
                                            <p className="text-sm font-medium text-zinc-400 max-w-[250px]">Modul Ai Autopilota zatiaľ nespracoval žiadne témy.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-10 px-2 pb-6">
                                            {Object.entries(autopilotHistory.reduce((acc, curr) => {
                                                const cat = curr.category || "Nezaradené";
                                                if (!acc[cat]) acc[cat] = [];
                                                acc[cat].push(curr);
                                                return acc;
                                            }, {} as Record<string, AutopilotHistoryItem[]>)).map(([category, items]) => (
                                                <div key={category} className="space-y-4">
                                                    <h4 className="flex items-center gap-3 text-white text-sm font-black uppercase tracking-widest border-b border-[#2a2a2a] pb-3">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-white/20 flex items-center justify-center">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                                        </div>
                                                        {category}
                                                        <span className="text-zinc-400 bg-[#2a2a2a] px-2 py-0.5 rounded-full text-[10px] ml-auto">({(items as AutopilotHistoryItem[]).length})</span>
                                                    </h4>
                                                    <div className="grid gap-3">
                                                        {(items as AutopilotHistoryItem[]).map((item, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex flex-col sm:flex-row gap-4 sm:items-center p-5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] hover:border-white/30 transition-all group"
                                                            >
                                                                <div className="flex-grow w-full">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <span className="text-[10px] text-zinc-400 font-bold tracking-wider bg-[#2a2a2a] px-2 py-1 rounded-md">
                                                                            {new Date(item.created_at).toLocaleString('sk-SK')}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="font-bold text-white text-sm xl:text-base leading-snug group-hover:text-zinc-200 transition-colors line-clamp-2 mb-3">
                                                                        {item.title}
                                                                    </h4>
                                                                    <a
                                                                        href={item.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white flex items-center gap-2 transition-colors w-fit border-b border-transparent hover:border-white pb-0.5"
                                                                    >
                                                                        <Globe className="w-3.5 h-3.5" />
                                                                        Otvoriť zdroj
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Area */}
                                <div className="px-8 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] text-center z-20">
                                    <p className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.15em]">
                                        Celkovo spravovaných sekcií: {Object.keys(autopilotHistory.reduce((acc, curr) => { acc[curr.category || ""] = true; return acc; }, {} as Record<string, boolean>)).length}
                                    </p>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )
                }

                {
                    selectedPlannerArticle && typeof document !== "undefined" && (() => {
                        const posts = plannedPosts.filter(p => p.article_id === selectedPlannerArticle);
                        if (posts.length === 0) return null;
                        const articleTitle = posts[0].articles?.title || "Neznámy článok";

                        return createPortal(
                            <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 md:p-8">
                                <div
                                    className="absolute inset-0 bg-black/80 backdrop-blur-xl cursor-pointer"
                                    onClick={() => setSelectedPlannerArticle(null)}
                                ></div>
                                <div className="relative bg-[#121212] w-full max-w-5xl rounded-[40px] border border-white/10 flex flex-col max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
                                    {/* Header */}
                                    <div className="px-6 py-5 md:px-10 md:py-6 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a] text-white">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/20 p-2.5 rounded-xl hidden xs:block">
                                                <Sparkles className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="text-base md:text-xl font-black uppercase tracking-widest leading-none mb-1 text-white line-clamp-1 max-w-[200px] xs:max-w-[400px] md:max-w-[500px]">{articleTitle}</h3>
                                                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Detail sociálnych postov</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedPlannerArticle(null)}
                                            className="p-2.5 bg-white/5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
                                        >
                                            <XCircle className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {/* Scrollable Content */}
                                    <div className="flex-grow overflow-y-auto w-full relative">
                                        {/* Bulk Actions Bar */}
                                        {selectedPostsForPublishing.length > 0 && (
                                            <div className="sticky top-0 z-[100] bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-full duration-300 rounded-b-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                                                        <Zap className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                                                        Vybrané: {selectedPostsForPublishing.length} príspevkov
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedPostsForPublishing([])}
                                                        className="text-[9px] font-black uppercase tracking-widest px-4 py-2 bg-black/10 hover:bg-black/20 rounded-lg transition-all"
                                                    >
                                                        Zrušiť
                                                    </button>
                                                    <button
                                                        onClick={handlePublishMultiplePosts}
                                                        disabled={status === "loading"}
                                                        className="text-[9px] font-black uppercase tracking-widest px-5 py-2 bg-white text-primary rounded-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                                                    >
                                                        {status === "loading" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                                        {status === "loading" ? "Odosielam..." : "Publikovať"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-full">
                                            {/* Posts Column */}
                                            <div className="p-5 md:p-8 space-y-6 bg-muted/[0.02] border-r border-white/5">
                                                {posts.map((post) => (
                                                    <div key={post.id} className={cn(
                                                        "rounded-3xl border transition-all",
                                                        post.status === 'posted'
                                                            ? "bg-muted/5 border-green-500/20"
                                                            : "bg-[#151515] border-white/[0.03] shadow-2xl shadow-black/50"
                                                    )}>
                                                        {/* Header: Platform & Actions */}
                                                        <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/[0.02]">
                                                            <div className="flex items-center gap-3">
                                                                {/* Checkbox for selection */}
                                                                {post.status !== 'posted' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedPostsForPublishing(prev =>
                                                                                prev.includes(post.id) ? prev.filter(id => id !== post.id) : [...prev, post.id]
                                                                            );
                                                                        }}
                                                                        className={cn(
                                                                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                                                                            selectedPostsForPublishing.includes(post.id)
                                                                                ? "bg-primary border-primary text-white"
                                                                                : "border-white/10 hover:border-white/20 bg-white/5"
                                                                        )}
                                                                    >
                                                                        {selectedPostsForPublishing.includes(post.id) && <Check className="w-3 h-3" strokeWidth={3} />}
                                                                    </button>
                                                                )}
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0",
                                                                        post.platform === 'Instagram' ? "bg-gradient-to-br from-indigo-500 via-purple-500 via-pink-500 to-orange-400" :
                                                                            post.platform === 'Facebook' ? "bg-[#1877F2]" : "bg-white text-black"
                                                                    )}>
                                                                        {post.platform === 'Instagram' && <Instagram size={18} />}
                                                                        {post.platform === 'Facebook' && <Facebook size={18} />}
                                                                        {post.platform === 'X' && <XIcon size={18} />}
                                                                    </div>
                                                                    <span className="text-sm font-black uppercase tracking-widest opacity-90">{post.platform}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                {post.status !== 'posted' && (post.platform === 'Facebook' || post.platform === 'Instagram') && (
                                                                    <button
                                                                        onClick={() => handlePublishSocialPost(post.id)}
                                                                        disabled={status === "loading"}
                                                                        className="h-8 px-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all flex items-center gap-2 group border border-primary/20 disabled:opacity-50"
                                                                        title="Publikovať teraz cez API"
                                                                    >
                                                                        {status === "loading" ? (
                                                                            <RefreshCw size={14} className="animate-spin" />
                                                                        ) : (
                                                                            <Zap size={14} className="group-hover:fill-current transition-all" />
                                                                        )}
                                                                        <span className="text-[10px] font-black uppercase tracking-tighter hidden xs:inline">
                                                                            {status === "loading" ? "Odosielam..." : "Publikovať"}
                                                                        </span>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleToggleSocialPosted(post)}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-lg transition-all flex items-center justify-center",
                                                                        post.status === 'posted' ? "bg-green-500 text-white" : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white"
                                                                    )}
                                                                    title={post.status === 'posted' ? "Už publikované" : "Označiť ako publikované"}
                                                                >
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Naozaj zmazať príspevok?')) {
                                                                            handleDeleteSocialPost(post.id);
                                                                            if (posts.length <= 1) setSelectedPlannerArticle(null);
                                                                        }
                                                                    }}
                                                                    className="w-8 h-8 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all flex items-center justify-center"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Content Area */}
                                                        <div className="p-4 md:p-5 space-y-3">
                                                            <div className="flex items-center justify-between px-1">
                                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Obsah príspevku</span>
                                                                <button
                                                                    onClick={() => { copyToClipboard(post.content); alert(`Text pre ${post.platform} bol skopírovaný.`); }}
                                                                    className="text-[9px] font-black uppercase tracking-widest text-primary/70 hover:text-primary flex items-center gap-1.5 transition-colors"
                                                                >
                                                                    <Copy size={11} /> Skopírovať
                                                                </button>
                                                            </div>
                                                            <div className="bg-black/20 border border-white/[0.03] rounded-2xl p-4 text-[13px] font-medium leading-relaxed max-h-[200px] overflow-y-auto whitespace-pre-wrap text-zinc-400 scrollbar-hide">
                                                                {post.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Preview Column */}
                                            <div className="p-6 md:p-10 bg-black/40 border-t lg:border-t-0 border-white/5 flex flex-col items-center justify-center lg:sticky lg:top-0 h-fit lg:h-[calc(90vh-80px)] min-h-[400px]">
                                                <div className="w-full max-w-[420px] scale-90 md:scale-100 flex flex-col items-center">
                                                    <InstagramPreview
                                                        title={articleTitle}
                                                        articleImage={posts[0].articles?.main_image}
                                                        category={posts[0].articles?.category}
                                                        summary={posts[0].articles?.ai_summary}
                                                        date={posts[0].articles?.published_at}
                                                    />
                                                    <div className="mt-8 flex flex-col items-center animate-pulse">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">Live Preview</span>
                                                        <div className="w-8 h-[1px] bg-primary/30 mt-2"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        );
                    })()
                }

                {
                    status === "loading" && message && createPortal(
                        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-foreground text-background px-10 py-6 rounded-[32px] shadow-2xl flex items-center gap-4 z-[2147483647] border border-white/10 ring-8 ring-black/5 whitespace-nowrap animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-sm font-black uppercase tracking-widest">{message}</span>
                        </div>,
                        document.body
                    )
                }

                {/* HIDDEN RENDERER FOR AUTOMATION */}
                {
                    automationArticleData && (
                        <div style={{
                            position: 'fixed',
                            top: '-10000px',
                            left: '0px',
                            width: '1080px',
                            height: '1080px',
                            zIndex: -100,
                            pointerEvents: 'none',
                            background: 'black'
                        }}>
                            <InstagramPreview
                                title={automationArticleData.title}
                                articleImage={articles.find(a => a.id === automationArticleData.id)?.main_image}
                                category={articles.find(a => a.id === automationArticleData.id)?.category}
                                summary={articles.find(a => a.id === automationArticleData.id)?.ai_summary}
                                date={articles.find(a => a.id === automationArticleData.id)?.published_at}
                                id="automation-preview-capture"
                            />
                        </div>
                    )
                }
            </div >
        </>
    );
}
