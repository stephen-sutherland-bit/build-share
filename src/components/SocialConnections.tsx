import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Link2, Unlink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LinkedIdentity {
  provider: string;
  identity_data?: {
    name?: string;
    email?: string;
    full_name?: string;
  };
}

export const SocialConnections = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [linkedInIdentity, setLinkedInIdentity] = useState<LinkedIdentity | null>(null);

  useEffect(() => {
    if (user) {
      loadIdentities();
    }
  }, [user]);

  const loadIdentities = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser?.identities) {
        const linkedin = currentUser.identities.find(
          (id) => id.provider === 'linkedin_oidc'
        );
        
        if (linkedin) {
          setLinkedInIdentity({
            provider: linkedin.provider,
            identity_data: linkedin.identity_data as LinkedIdentity['identity_data']
          });
        } else {
          setLinkedInIdentity(null);
        }
      }
    } catch (err) {
      console.error('Error loading identities:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectLinkedIn = async () => {
    if (!user) return;
    setConnecting('linkedin');

    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/settings`
        }
      });

      if (error) {
        console.error('LinkedIn link error:', error);
        toast.error(error.message || 'Failed to connect LinkedIn');
        setConnecting(null);
      }
      // If successful, user will be redirected to LinkedIn
    } catch (err) {
      console.error('Connect error:', err);
      toast.error('Failed to start LinkedIn connection');
      setConnecting(null);
    }
  };

  const disconnectLinkedIn = async () => {
    if (!user) return;
    setDisconnecting('linkedin');

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const linkedinIdentity = currentUser?.identities?.find(
        (id) => id.provider === 'linkedin_oidc'
      );

      if (!linkedinIdentity) {
        toast.error('LinkedIn identity not found');
        setDisconnecting(null);
        return;
      }

      const { error } = await supabase.auth.unlinkIdentity(linkedinIdentity);

      if (error) {
        console.error('Unlink error:', error);
        toast.error(error.message || 'Failed to disconnect LinkedIn');
      } else {
        toast.success('Disconnected from LinkedIn');
        setLinkedInIdentity(null);
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect from LinkedIn');
    } finally {
      setDisconnecting(null);
    }
  };

  // Check for OAuth callback on mount
  useEffect(() => {
    const checkOAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      const error = hashParams.get('error') || queryParams.get('error');
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
      
      if (error) {
        toast.error(errorDescription || `LinkedIn connection failed: ${error}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // If we just came back from OAuth, refresh identities
      if (window.location.hash || queryParams.has('code')) {
        await loadIdentities();
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (linkedInIdentity) {
          toast.success('LinkedIn connected successfully!');
        }
      }
    };

    checkOAuthCallback();
  }, []);

  const getDisplayName = () => {
    if (!linkedInIdentity?.identity_data) return 'Connected';
    return linkedInIdentity.identity_data.full_name || 
           linkedInIdentity.identity_data.name || 
           linkedInIdentity.identity_data.email || 
           'Connected';
  };

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
                    {linkedInIdentity && (
                      <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  {linkedInIdentity ? (
                    <p className="text-sm text-muted-foreground">
                      {getDisplayName()}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Post updates and share content
                    </p>
                  )}
                </div>
              </div>
              
              {linkedInIdentity ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectLinkedIn}
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
            Your social media credentials are managed securely through our authentication system.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
