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

    const url = new URL(req.url);
    const chargeId = url.searchParams.get("id");
    const shortCode = url.searchParams.get("short_code");

    if (!chargeId && !shortCode) {
      return new Response(
        JSON.stringify({ error: "Provide id or short_code parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify API key
    const { data: merchant, error: mErr } = await supabase
      .from("merchants")
      .select("id, status")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (mErr || !merchant) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch charge
    let query = supabase
      .from("charges")
      .select("id, short_code, amount, currency, reference, status, expires_at, created_at, paid_at, transaction_id")
      .eq("merchant_id", merchant.id);

    if (chargeId) query = query.eq("id", chargeId);
    if (shortCode) query = query.eq("short_code", shortCode);

    const { data: charge, error: cErr } = await query.maybeSingle();

    if (cErr || !charge) {
      return new Response(
        JSON.stringify({ error: "Charge not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(charge),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
