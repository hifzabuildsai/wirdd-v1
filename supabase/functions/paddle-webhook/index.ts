import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get('paddle-signature') ?? '';

  // Verify Paddle signature (ts=...;h1=...)
  const verified = await verifyPaddleSignature(body, signature, PADDLE_WEBHOOK_SECRET);
  if (!verified) {
    console.error('[paddle-webhook] signature mismatch');
    return new Response('Unauthorized', { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const eventType = event.event_type as string | undefined;

  // Handle completed transactions (one-time purchase)
  if (eventType === 'transaction.completed') {
    const data = event.data as Record<string, unknown> | undefined;
    const customData = data?.custom_data as Record<string, string> | undefined;
    const userId = customData?.user_id;

    if (!userId) {
      console.error('[paddle-webhook] missing user_id in custom_data');
      return new Response('OK', { status: 200 });
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, is_premium: true, plan: 'pro' },
        { onConflict: 'id' },
      );

    if (error) {
      console.error('[paddle-webhook] upsert error:', error.message);
      return new Response('Internal error', { status: 500 });
    }

    console.log('[paddle-webhook] unlocked pro for user:', userId);
  }

  return new Response('OK', { status: 200 });
});

async function verifyPaddleSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!secret || !signature) return false;

  // Parse ts and h1 from "ts=1234567890;h1=abc..."
  const parts = Object.fromEntries(
    signature.split(';').map((p) => p.split('=')),
  );
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const payload = `${ts}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === h1;
}
