import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (!userId) {
          console.error("No user ID in session");
          break;
        }

        // Get the subscription from Stripe
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Create or update subscription in database
        const subscriptionData = {
          user_id: userId,
          status: subscription.status === "active" ? "active" : "incomplete",
          current_period_start: new Date(
            subscription.current_period_start * 1000
          ).toISOString(),
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          payment_provider: "stripe",
          payment_provider_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        };

        // Check if subscription exists
        const { data: existing } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existing) {
          // Update existing subscription
          await supabaseAdmin
            .from("subscriptions")
            .update(subscriptionData)
            .eq("user_id", userId);
        } else {
          // Create new subscription
          await supabaseAdmin.from("subscriptions").insert(subscriptionData);
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;

        if (!userId) {
          // Try to find user by subscription ID
          const { data: existingSub } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .eq("payment_provider_subscription_id", subscription.id)
            .single();

          if (!existingSub) {
            console.error("Could not find subscription in database");
            break;
          }

          const subscriptionData = {
            status:
              subscription.status === "active"
                ? "active"
                : subscription.status === "canceled"
                ? "canceled"
                : subscription.status === "past_due"
                ? "past_due"
                : "incomplete",
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            updated_at: new Date().toISOString(),
          };

          await supabaseAdmin
            .from("subscriptions")
            .update(subscriptionData)
            .eq("payment_provider_subscription_id", subscription.id);
        } else {
          const subscriptionData = {
            status:
              subscription.status === "active"
                ? "active"
                : subscription.status === "canceled"
                ? "canceled"
                : subscription.status === "past_due"
                ? "past_due"
                : "incomplete",
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            updated_at: new Date().toISOString(),
          };

          await supabaseAdmin
            .from("subscriptions")
            .update(subscriptionData)
            .eq("user_id", userId);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("payment_provider_subscription_id", subscription.id);

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

