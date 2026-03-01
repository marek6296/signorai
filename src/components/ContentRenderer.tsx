"use client";

import React from "react";
import { InContentAd } from "./InContentAd";
import { type Article } from "@/lib/data";

interface ContentRendererProps {
    content: string;
    relatedArticles: Article[];
}

export function ContentRenderer({ content, relatedArticles }: ContentRendererProps) {
    if (!content) return null;

    // Splitting logic:
    // 1. Identify paragraph blocks (usually separated by </p> in HTML)
    // 2. We want to inject the ad after a certain number of paragraphs.
    // 3. If the article is long enough (e.g., > 4 paragraphs), we inject it after the 2nd or 3rd paragraph.
    // 4. If it's shorter, we might just put it at the end or not at all.

    const paragraphs = content.split('</p>');

    // Clean up empty strings and re-add the closing tag
    const cleanParagraphs = paragraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => p + '</p>');

    if (cleanParagraphs.length < 3 || relatedArticles.length === 0) {
        // Just render the original content if it's too short or no related articles
        return (
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        );
    }

    // Determine injection point (e.g., after the 2nd paragraph, or in the middle)
    const injectionPoint = Math.min(2, Math.floor(cleanParagraphs.length / 2));

    const beforeAd = cleanParagraphs.slice(0, injectionPoint).join('');
    const afterAd = cleanParagraphs.slice(injectionPoint).join('');

    return (
        <div className="flex flex-col">
            {/* Top part */}
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: beforeAd }}
            />

            {/* The Ad / Recommendation - NOT inside prose to avoid style conflicts */}
            <InContentAd articles={relatedArticles} />

            {/* Bottom part */}
            <div
                className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary/80"
                dangerouslySetInnerHTML={{ __html: afterAd }}
            />
        </div>
    );
}
