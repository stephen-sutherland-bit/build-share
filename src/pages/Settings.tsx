import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { SocialConnections } from "@/components/SocialConnections";

interface CompanyDetails {
  name: string;
  description: string;
  website?: string;
  phone?: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [details, setDetails] = useState<CompanyDetails>({
    name: "",
    description: "",
    website: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCompanyDetails();
  }, [user]);

  const loadCompanyDetails = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading company:', error);
        toast.error('Failed to load company details');
      } else if (data) {
        setDetails({
          name: data.name,
          description: data.description,
          website: data.website || "",
          phone: data.phone || "",
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.name || !details.description || !user) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('companies')
        .upsert({
          user_id: user.id,
          name: details.name,
          description: details.description,
          website: details.website || null,
          phone: details.phone || null,
        });

      if (error) throw error;

      toast.success('Company details saved successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error('Failed to save company details');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-hero">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <Card className="shadow-medium border-border/50 max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-display">Company Settings</CardTitle>
                <CardDescription>
                  Manage your construction company information for branded content
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    placeholder="ABC Construction Co."
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={details.website}
                  onChange={(e) => setDetails({ ...details, website: e.target.value })}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Company Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your company's services, specialties, and what makes you unique..."
                  value={details.description}
                  onChange={(e) => setDetails({ ...details, description: e.target.value })}
                  required
                  rows={4}
                  className="resize-none"
                  disabled={isSaving}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full md:w-auto gradient-primary"
                size="lg"
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Company Details'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Social Connections Section */}
        <div className="mt-8">
          <SocialConnections />
        </div>
      </main>
    </div>
  );
};

export default Settings;
