import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email || !email.includes('@')) {
            return NextResponse.json({ message: "Neplatný email." }, { status: 400 });
        }

        // Check if already subscribed in a "newsletter_subscribers" table
        // We'll use upsert to handle duplicates gracefully
        const { error } = await supabase
            .from('newsletter_subscribers')
            .upsert({ email, updated_at: new Date().toISOString() }, { onConflict: 'email' });

        if (error) {
            console.error("Newsletter subscription error:", error);
            // If the table doesn't exist, this will fail. 
            return NextResponse.json({
                message: "Chyba pri prihlasovaní. Skúste to prosím neskôr."
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Email úspešne uložený." });

    } catch (error) {
        console.error("Newsletter API error:", error);
        return NextResponse.json({ message: "Chyba na serveri." }, { status: 500 });
    }
}
