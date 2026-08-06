import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pending webhook deliveries
    const { data: webhooks, error: wErr } = await supabase
      .from("webhook_deliveries")
      .select("id, charge_id, merchant_id, payload, attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);

    if (wErr) throw wErr;

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ delivered: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deliveredCount = 0;

    for (const webhook of webhooks) {
      // Get merchant webhook URL
      const { data: merchant } = await supabase
        .from("merchants")
        .select("webhook_url, status")
        .eq("id", webhook.merchant_id)
        .maybeSingle();

      if (!merchant || !merchant.webhook_url || merchant.status !== "active") {
        // Skip — no webhook URL or merchant inactive
        await supabase
          .from("webhook_deliveries")
          .update({ status: "failed", attempts: webhook.attempts + 1 })
          .eq("id", webhook.id);
        continue;
      }

      try {
        const response = await fetch(merchant.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhook.payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          await supabase
            .from("webhook_deliveries")
            .update({
              status: "delivered",
              attempts: webhook.attempts + 1,
              response_status: response.status,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", webhook.id);
          deliveredCount++;
        } else {
          await supabase
            .from("webhook_deliveries")
            .update({
              status: webhook.attempts + 1 >= 3 ? "failed" : "pending",
              attempts: webhook.attempts + 1,
              response_status: response.status,
            })
            .eq("id", webhook.id);
        }
      } catch (fetchErr) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status: webhook.attempts + 1 >= 3 ? "failed" : "pending",
            attempts: webhook.attempts + 1,
          })
          .eq("id", webhook.id);
      }
    }

    return new Response(
      JSON.stringify({ delivered: deliveredCount, total: webhooks.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
