"use client";

import React from "react";
import { InContentAd } from "./InContentAd";
import { type Article } from "@/lib/data";

interface ContentRendererProps {
    content: string;
    relatedArticles: Article[];
    showAds?: boolean;
}

/**
 * ContentRenderer — renderuje HTML obsah článku.
 * Vkladá odporúčaný článok (InContentAd) do stredu obsahu.
 */
export function ContentRenderer({ content, relatedArticles }: ContentRendererProps) {
    if (!content) return null;

    const paragraphs = content.split('</p>');
    const cleanParagraphs = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p + '</p>');

    const totalParagraphs = cleanParagraphs.length;

    // Short articles or no related — just render content
    if (totalParagraphs < 3 || relatedArticles.length === 0) {
        return (
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Inject related article recommendation at ~50% of content
    const midPoint = Math.max(2, Math.floor(totalParagraphs / 2));
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
