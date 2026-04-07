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
 * - Žiadna reklama na začiatku článku (prvých 30% obsahu)
 * - Reklamy nie sú vedľa seba (min 3 odseky medzi nimi)
 * - 1. banner po ~40% obsahu (468x60)
 * - 2. banner po ~75% obsahu (300x250)
 * - InContentAd (odporúčaný článok) sa vkladá po ~55% obsahu
 */
export function ContentRenderer({ content, relatedArticles, showAds = false }: ContentRendererProps) {
    if (!content) return null;

    // Split content into paragraphs
    const paragraphs = content.split('</p>');
    const cleanParagraphs = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p + '</p>');

    const totalParagraphs = cleanParagraphs.length;

    // For short articles (< 6 paragraphs), don't inject any ads
    if (totalParagraphs < 6 || !showAds) {
        const hasRelated = relatedArticles.length > 0 && totalParagraphs >= 3;

        if (!hasRelated) {
            return (
                <div
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            );
        }

        // Only inject InContentAd for short articles
        const midPoint = Math.floor(totalParagraphs / 2);
        const before = cleanParagraphs.slice(0, midPoint).join('');
        const after = cleanParagraphs.slice(midPoint).join('');

        return (
            <div className="flex flex-col">
                <div
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: before }}
                />
                <InContentAd articles={relatedArticles} />
                <div
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: after }}
                />
            </div>
        );
    }

    // For longer articles, calculate injection points
    // Ad 1: after ~40% of content (min paragraph 3)
    const ad1Index = Math.max(3, Math.floor(totalParagraphs * 0.4));

    // InContentAd (related article recommendation): after ~55%
    const relatedIndex = Math.max(ad1Index + 3, Math.floor(totalParagraphs * 0.55));

    // Ad 2: after ~75% of content (at least 3 paragraphs after related)
    const ad2Index = Math.max(relatedIndex + 3, Math.floor(totalParagraphs * 0.75));

    // Build content sections
    const sections: React.ReactNode[] = [];

    // Section 1: Start to Ad1
    const section1 = cleanParagraphs.slice(0, ad1Index).join('');
    sections.push(
        <div
            key="s1"
            className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
            dangerouslySetInnerHTML={{ __html: section1 }}
        />
    );

    // Ad 1 — 468x60 banner
    sections.push(
        <div key="ad1" className="my-6 flex justify-center">
            <AdBanner type="468x60" label />
        </div>
    );

    // Section 2: Ad1 to Related/Ad2
    if (relatedArticles.length > 0 && relatedIndex < totalParagraphs) {
        const section2 = cleanParagraphs.slice(ad1Index, relatedIndex).join('');
        sections.push(
            <div
                key="s2"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: section2 }}
            />
        );

        // InContentAd (related article recommendation)
        sections.push(<InContentAd key="related" articles={relatedArticles} />);

        // Section 3: Related to Ad2
        if (ad2Index < totalParagraphs) {
            const section3 = cleanParagraphs.slice(relatedIndex, ad2Index).join('');
            sections.push(
                <div
                    key="s3"
                    className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: section3 }}
                />
            );

            // Ad 2 — 300x250 banner
            sections.push(
                <div key="ad2" className="my-6 flex justify-center">
                    <AdBanner type="300x250" label />
                </div>
            );

            // Section 4: After Ad2 to end
            const section4 = cleanParagraphs.slice(ad2Index).join('');
            if (section4.trim()) {
                sections.push(
                    <div
                        key="s4"
                        className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                        dangerouslySetInnerHTML={{ __html: section4 }}
                    />
                );
            }
        } else {
            // Not enough paragraphs for Ad2, just finish with remaining content
            const remaining = cleanParagraphs.slice(relatedIndex).join('');
            if (remaining.trim()) {
                sections.push(
                    <div
                        key="s3"
                        className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                        dangerouslySetInnerHTML={{ __html: remaining }}
                    />
                );
            }
            // Ad 2 at the end
            sections.push(
                <div key="ad2" className="my-6 flex justify-center">
                    <AdBanner type="300x250" label />
                </div>
            );
        }
    } else {
        // No related articles — just place ad2 later
        const section2 = cleanParagraphs.slice(ad1Index, ad2Index < totalParagraphs ? ad2Index : totalParagraphs).join('');
        sections.push(
            <div
                key="s2"
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: section2 }}
            />
        );

        if (ad2Index < totalParagraphs) {
            // Ad 2 — 300x250 banner
            sections.push(
                <div key="ad2" className="my-6 flex justify-center">
                    <AdBanner type="300x250" label />
                </div>
            );
            const remaining = cleanParagraphs.slice(ad2Index).join('');
            if (remaining.trim()) {
                sections.push(
                    <div
                        key="s3"
                        className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                        dangerouslySetInnerHTML={{ __html: remaining }}
                    />
                );
            }
        } else {
            // Ad 2 at the end
            sections.push(
                <div key="ad2" className="my-6 flex justify-center">
                    <AdBanner type="300x250" label />
                </div>
            );
        }
    }

    return <div className="flex flex-col">{sections}</div>;
}
