import { useState, useEffect } from "react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { ContentPreview } from "@/components/ContentPreview";
import { Sparkles, Zap, Layout } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-construction.jpg";

interface CompanyDetails {
  name: string;
  description: string;
  website?: string;
  phone?: string;
}

interface ProcessedContent {
  photos: Array<{ url: string; timestamp?: string }>;
  captions: Array<{ platform?: string; text: string } | string>;
  hashtags: string[];
  layouts: Array<{ type: string; preview: string }>;
}

const Index = () => {
  const { user } = useAuth();
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [processingProgress, setProcessingProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadCompanyDetails();
    }
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
      } else if (data) {
        setCompanyDetails({
          name: data.name,
          description: data.description,
          website: data.website || undefined,
          phone: data.phone || undefined,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingCompany(false);
    }
  };

  const handlePhotosUpload = (files: File[]) => {
    setUploadedPhotos(files);
    toast.success(`${files.length} photos uploaded!`);
  };

  const handleProcess = async () => {
    if (!companyDetails) {
      toast.error("Please add company details in Settings first");
      return;
    }
    if (uploadedPhotos.length === 0) {
      toast.error("Please upload photos first");
      return;
    }

    setIsProcessing(true);
    toast.info("Processing photos with AI...");

    const totalBatches = Math.ceil(uploadedPhotos.length / 10);
    setProcessingProgress({ currentBatch: 0, totalBatches });

    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev && prev.currentBatch < prev.totalBatches) {
          return { ...prev, currentBatch: prev.currentBatch + 1 };
        }
        return prev;
      });
    }, 6000);

    try {
      // Convert files to base64 for AI processing
      const photoPromises = uploadedPhotos.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const photoUrls = await Promise.all(photoPromises);
      const photos = photoUrls.map(url => ({ url }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            photos,
            companyDetails
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process photos');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Reorder photos based on AI suggestion
        const orderedPhotos = result.data.chronologicalOrder.map((idx: number) => ({
          url: photoUrls[idx],
          timestamp: new Date().toISOString()
        }));

        setProcessedContent({
          photos: orderedPhotos,
          captions: result.data.captions,
          hashtags: result.data.hashtags,
          layouts: result.data.layouts
        });
        
        toast.success("Photos processed successfully!");
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process photos');
    } finally {
      clearInterval(progressInterval);
      setProcessingProgress(null);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 gradient-hero opacity-90" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6 animate-fade-in">
            <h2 className="text-4xl md:text-6xl font-display font-bold text-foreground">
              Transform Job Photos into 
              <span className="block gradient-primary bg-clip-text text-transparent mt-2">
                Social Media Gold
              </span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your construction project photos and let AI create engaging social media content with captions, hashtags, and professional layouts—ready to post in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-medium">AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">Instant Results</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Layout className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-medium">Pro Layouts</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {loadingCompany ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : !companyDetails ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-lg text-muted-foreground">
              Please set up your company details first to start creating content.
            </p>
            <Button asChild className="gradient-primary">
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Photo Upload Section */}
            <section className="animate-slide-in">
              <PhotoUploader 
                onUpload={handlePhotosUpload}
                onProcess={handleProcess}
                isProcessing={isProcessing}
                photoCount={uploadedPhotos.length}
                processingProgress={processingProgress}
              />
            </section>

            {/* Content Preview Section */}
            {processedContent && (
              <section className="animate-fade-in">
                <ContentPreview content={processedContent} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by BuildPost AI • Transform your construction content instantly</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
