# Stripe Integration Setup Guide

## Prerequisites

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard

## Setup Steps

### 1. Add Stripe Environment Variables to Supabase

In your Supabase project dashboard:

1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Add the following secrets:

   - `STRIPE_SECRET_KEY` - Your Stripe Secret Key (starts with `sk_`)
   - `STRIPE_WEBHOOK_SECRET` - Your Stripe Webhook Secret (starts with `whsec_`)

### 2. Deploy Edge Functions

Deploy the Edge Functions to Supabase:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the functions
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

### 3. Set Up Stripe Webhook

1. Go to your Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

### 4. Test the Integration

1. Use Stripe test mode keys for testing
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date and CVC
4. Complete the checkout flow
5. Verify subscription is created in your database

## Testing

### Test Mode

- Use Stripe test keys (start with `sk_test_` and `pk_test_`)
- Use test card numbers from: https://stripe.com/docs/testing

### Production

- Switch to live keys (start with `sk_live_` and `pk_live_`)
- Update webhook endpoint to production URL
- Test with real payment methods

## Troubleshooting

- **Checkout not redirecting**: Verify Edge Function is deployed and `STRIPE_SECRET_KEY` is set
- **Webhook not working**: Verify webhook URL is correct and `STRIPE_WEBHOOK_SECRET` matches
- **Subscription not created**: Check Supabase logs and Stripe webhook logs

