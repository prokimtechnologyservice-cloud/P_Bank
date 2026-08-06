import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("X-Api-Key") || "";
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing X-Api-Key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { amount, reference, currency = "THB" } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find merchant by API key
    const { data: merchant, error: mErr } = await supabase
      .from("merchants")
      .select("id, status, business_name")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (mErr || !merchant) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (merchant.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Merchant account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique short code (6 chars)
    const shortCode = generateShortCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: charge, error: cErr } = await supabase
      .from("charges")
      .insert({
        merchant_id: merchant.id,
        amount,
        currency,
        reference: reference || "",
        status: "pending",
        short_code: shortCode,
        expires_at: expiresAt,
      })
      .select("id, short_code, amount, currency, reference, status, expires_at, created_at")
      .single();

    if (cErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create charge", details: cErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        id: charge.id,
        short_code: charge.short_code,
        amount: charge.amount,
        currency: charge.currency,
        reference: charge.reference,
        status: charge.status,
        expires_at: charge.expires_at,
        created_at: charge.created_at,
        pay_url: `${req.headers.get("origin") || ""}/pay/${charge.short_code}`,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
