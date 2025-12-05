import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Link2, Unlink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SocialConnection {
  id: string;
  platform: string;
  platform_username: string | null;
  expires_at: string | null;
  created_at: string;
}

export const SocialConnections = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user]);

  // Handle OAuth callback (works in both popup and main window)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        toast.error(`LinkedIn authorization failed: ${error}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        // Close popup if this is a popup window
        if (window.opener) {
          window.close();
        }
        return;
      }

      if (code && state === 'linkedin_auth' && user) {
        setConnecting('linkedin');
        try {
          const redirectUri = `${window.location.origin}/settings`;
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-auth?action=exchange-code`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirectUri,
                userId: user.id
              })
            }
          );

          const data = await response.json();

          if (data.success) {
            toast.success(`Connected to LinkedIn as ${data.username}`);
            loadConnections();
            // Close popup and notify parent window if this is a popup
            if (window.opener) {
              window.opener.postMessage({ type: 'linkedin_connected' }, '*');
              window.close();
            }
          } else {
            toast.error(data.error || 'Failed to connect to LinkedIn');
          }
        } catch (err) {
          console.error('OAuth callback error:', err);
          toast.error('Failed to complete LinkedIn connection');
        } finally {
          setConnecting(null);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthCallback();
  }, [user]);

  // Listen for messages from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'linkedin_connected') {
        loadConnections();
        toast.success('LinkedIn connected successfully!');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('id, platform, platform_username, expires_at, created_at')
        .eq('user_id', user.id);

      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectLinkedIn = async () => {
    if (!user) return;
    setConnecting('linkedin');

    try {
      const redirectUri = `${window.location.origin}/settings`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-auth?action=get-auth-url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            redirectUri,
            state: 'linkedin_auth'
          })
        }
      );

      const data = await response.json();

      if (data.authUrl) {
        // Open LinkedIn OAuth in a popup window (avoids iframe restrictions)
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'linkedin_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
        );

        // Poll for popup closure and check for OAuth callback
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            setConnecting(null);
            // Reload connections in case OAuth completed
            loadConnections();
          }
        }, 500);
      } else {
        toast.error(data.error || 'Failed to get LinkedIn authorization URL');
        setConnecting(null);
      }
    } catch (err) {
      console.error('Connect error:', err);
      toast.error('Failed to start LinkedIn connection');
      setConnecting(null);
    }
  };

  const disconnectPlatform = async (platform: string) => {
    if (!user) return;
    setDisconnecting(platform);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-auth?action=disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Disconnected from LinkedIn');
        loadConnections();
      } else {
        toast.error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect from LinkedIn');
    } finally {
      setDisconnecting(null);
    }
  };

  const getConnectionForPlatform = (platform: string) => {
    return connections.find(c => c.platform === platform);
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const linkedInConnection = getConnectionForPlatform('linkedin');

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl font-display">Connected Accounts</CardTitle>
            <CardDescription>
              Connect your social media accounts to post directly from the app
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* LinkedIn Connection */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center">
                  <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">LinkedIn</span>
                    {linkedInConnection && (
                      <>
                        {isTokenExpired(linkedInConnection.expires_at) ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  {linkedInConnection ? (
                    <p className="text-sm text-muted-foreground">
                      {linkedInConnection.platform_username || 'Connected'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Post updates and share content
                    </p>
                  )}
                </div>
              </div>
              
              {linkedInConnection ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectPlatform('linkedin')}
                  disabled={disconnecting === 'linkedin'}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {disconnecting === 'linkedin' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connectLinkedIn}
                  disabled={connecting === 'linkedin'}
                  className="border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/10"
                >
                  {connecting === 'linkedin' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Future platforms placeholder */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-muted/30 opacity-60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Facebook & Instagram</span>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                Soon
              </Badge>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Your social media credentials are encrypted and stored securely. We only request the minimum permissions needed to post on your behalf.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
