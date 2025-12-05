import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const LINKEDIN_CLIENT_ID = Deno.env.get('LINKEDIN_CLIENT_ID');
    const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if LinkedIn credentials are configured
    if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
      console.error('LinkedIn credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'LinkedIn API credentials not configured. Please add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET secrets.' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Action: Get OAuth URL to redirect user to LinkedIn
    if (action === 'get-auth-url') {
      const body = await req.json();
      const { redirectUri, state } = body;

      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: 'redirectUri is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // LinkedIn OAuth 2.0 authorization URL
      // Note: w_member_social scope requires LinkedIn app review/approval
      // Start with basic scopes for development, add w_member_social after app is approved
      const scope = 'openid profile email';
      const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state || crypto.randomUUID());
      authUrl.searchParams.set('scope', scope);
      // Force fresh login - don't use cached session
      authUrl.searchParams.set('prompt', 'login');

      console.log('Generated LinkedIn auth URL');

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Exchange authorization code for access token
    if (action === 'exchange-code') {
      const body = await req.json();
      const { code, redirectUri, userId } = body;

      if (!code || !redirectUri || !userId) {
        return new Response(
          JSON.stringify({ error: 'code, redirectUri, and userId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Exchanging code for access token...');

      // Exchange code for access token
      const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for token', details: errorText }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      // Get user profile from LinkedIn
      const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      let profileData = null;
      if (profileResponse.ok) {
        profileData = await profileResponse.json();
        console.log('Profile fetched successfully');
      } else {
        console.warn('Could not fetch profile:', await profileResponse.text());
      }

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      // Store connection in database
      const { error: upsertError } = await supabase
        .from('social_connections')
        .upsert({
          user_id: userId,
          platform: 'linkedin',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt,
          platform_user_id: profileData?.sub || null,
          platform_username: profileData?.name || profileData?.email || null,
        }, {
          onConflict: 'user_id,platform'
        });

      if (upsertError) {
        console.error('Database error:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save connection', details: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('LinkedIn connection saved successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          username: profileData?.name || 'LinkedIn User',
          expiresAt 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Disconnect LinkedIn account
    if (action === 'disconnect') {
      const body = await req.json();
      const { userId } = body;

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('social_connections')
        .delete()
        .eq('user_id', userId)
        .eq('platform', 'linkedin');

      if (deleteError) {
        console.error('Disconnect error:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect', details: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('LinkedIn disconnected successfully');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: get-auth-url, exchange-code, or disconnect' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LinkedIn auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
