"use client";

import React from "react";
import { InContentAd } from "./InContentAd";
import { AdBanner } from "./AdBanner";
import { type Article } from "@/lib/data";

interface ContentRendererProps {
    content: string;
    relatedArticles: Article[];
    showAds?: boolean;
}

/**
 * ContentRenderer — renderuje HTML obsah článku s vloženými reklamami.
 *
 * Pravidlá pre reklamy:
 * - Max 2 Adsterra bannery v článku
 * - Žiadna reklama na začiatku článku (prvé 2 odseky)
 * - Reklamy nie sú vedľa seba (min 2 odseky medzi nimi)
 * - 1. banner po ~35% obsahu (468x60)
 * - 2. banner po ~70% obsahu (300x250)
 * - InContentAd (odporúčaný článok) sa vkladá medzi ne (~50%)
 */
export function ContentRenderer({ content, relatedArticles, showAds = false }: ContentRendererProps) {
    if (!content) return null;

    const paragraphs = content.split('</p>');
    const cleanParagraphs = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p + '</p>');

    const totalParagraphs = cleanParagraphs.length;

    // No ads at all if showAds is off
    if (!showAds) {
        return (
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Very short articles (< 4 paragraphs) — no ads, maybe related article
    if (totalParagraphs < 4) {
        if (relatedArticles.length > 0) {
            return (
                <div className="flex flex-col">
                    <div
                        className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                    <InContentAd articles={relatedArticles} />
                </div>
            );
        }
        return (
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Short articles (4-5 paragraphs) — 1 ad + related
    if (totalParagraphs < 6) {
        const adIndex = Math.max(2, Math.floor(totalParagraphs * 0.5));
        const before = cleanParagraphs.slice(0, adIndex).join('');
        const after = cleanParagraphs.slice(adIndex).join('');

        return (
            <div className="flex flex-col">
                <div
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: before }}
                />
                <div className="my-6 flex justify-center">
                    <AdBanner type="468x60" label />
                </div>
                {relatedArticles.length > 0 && <InContentAd articles={relatedArticles} />}
                <div
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: after }}
                />
            </div>
        );
    }

    // Medium-long articles (6+ paragraphs) — 2 ads + related
    // Ad 1: after ~35% of content (min paragraph 2)
    const ad1Index = Math.max(2, Math.floor(totalParagraphs * 0.35));

    // InContentAd (related article): after ~50%
    const relatedIndex = Math.max(ad1Index + 2, Math.floor(totalParagraphs * 0.5));

    // Ad 2: after ~70% of content (at least 2 paragraphs after related)
    const ad2Index = Math.max(relatedIndex + 2, Math.floor(totalParagraphs * 0.7));

    const sections: React.ReactNode[] = [];

    // Section 1: Start to Ad1
    sections.push(
        <div
            key="s1"
            className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
            dangerouslySetInnerHTML={{ __html: cleanParagraphs.slice(0, ad1Index).join('') }}
        />
    );

    // Ad 1 — 468x60 banner
    sections.push(
        <div key="ad1" className="my-6 flex justify-center">
            <AdBanner type="468x60" label />
        </div>
    );

    // Section 2: Ad1 to Related
    if (relatedArticles.length > 0 && relatedIndex < totalParagraphs) {
        sections.push(
            <div
                key="s2"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: cleanParagraphs.slice(ad1Index, relatedIndex).join('') }}
            />
        );
        sections.push(<InContentAd key="related" articles={relatedArticles} />);
    } else {
        // No related articles — content between ad1 and ad2
        sections.push(
            <div
                key="s2"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: cleanParagraphs.slice(ad1Index, ad2Index).join('') }}
            />
        );
    }

    // Section 3 + Ad 2
    const ad2Start = relatedArticles.length > 0 ? relatedIndex : ad2Index;

    if (ad2Index < totalParagraphs && ad2Index > ad2Start) {
        sections.push(
            <div
                key="s3"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: cleanParagraphs.slice(ad2Start, ad2Index).join('') }}
            />
        );
    }

    // Ad 2 — 300x250 banner
    sections.push(
        <div key="ad2" className="my-6 flex justify-center">
            <AdBanner type="300x250" label />
        </div>
    );

    // Remaining content after Ad2
    const remainingStart = Math.max(ad2Index, ad2Start);
    const remaining = cleanParagraphs.slice(remainingStart).join('');
    if (remaining.trim()) {
        sections.push(
            <div
                key="s4"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: remaining }}
            />
        );
    }

    return <div className="flex flex-col">{sections}</div>;
}
