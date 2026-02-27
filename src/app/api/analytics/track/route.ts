import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { UAParser } from "ua-parser-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { path, referrer, visitor_id, user_agent } = body;

        const ua = new UAParser(user_agent);
        const browser = ua.getBrowser().name;
        const os = ua.getOS().name;
        const device = ua.getDevice().type || 'desktop';

        // Get geo info from Vercel headers
        const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
        const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
        const region = req.headers.get('x-vercel-ip-region') || 'Unknown';
        const timezone = req.headers.get('x-vercel-ip-timezone') || 'Unknown';
        const latitude = req.headers.get('x-vercel-ip-latitude') || 'Unknown';
        const longitude = req.headers.get('x-vercel-ip-longitude') || 'Unknown';

        const { error } = await supabase.from("site_visits").insert({
            path,
            referrer,
            visitor_id,
            user_agent,
            browser,
            os,
            device,
            country,
            city,
            region,
            timezone,
            latitude,
            longitude
        });

        if (error) {
            console.error("Supabase analytics error:", error);
            // If columns don't exist, we fall back to minimal tracking to avoid breaking
            if (error.code === '42703') { // undefined_column
                await supabase.from("site_visits").insert({
                    path,
                    referrer,
                    visitor_id,
                    user_agent
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Analytics track error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
