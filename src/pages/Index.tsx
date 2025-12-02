import { useState } from "react";
import { CompanyForm } from "@/components/CompanyForm";
import { PhotoUploader } from "@/components/PhotoUploader";
import { ContentPreview } from "@/components/ContentPreview";
import { Building2, Sparkles, Zap, Layout } from "lucide-react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-construction.jpg";

interface CompanyDetails {
  name: string;
  description: string;
  website?: string;
  phone?: string;
}

interface ProcessedContent {
  photos: Array<{ url: string; timestamp?: string }>;
  captions: string[];
  hashtags: string[];
  layouts: Array<{ type: string; preview: string }>;
}

const Index = () => {
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCompanySave = (details: CompanyDetails) => {
    setCompanyDetails(details);
    toast.success("Company details saved!");
  };

  const handlePhotosUpload = (files: File[]) => {
    setUploadedPhotos(files);
    toast.success(`${files.length} photos uploaded!`);
  };

  const handleProcess = async () => {
    if (!companyDetails) {
      toast.error("Please add company details first");
      return;
    }
    if (uploadedPhotos.length === 0) {
      toast.error("Please upload photos first");
      return;
    }

    setIsProcessing(true);
    toast.info("Processing photos with AI...");

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
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              BuildPost AI
            </h1>
            <p className="text-sm text-muted-foreground">Construction Content Creator</p>
          </div>
        </div>
      </header>

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
        {/* Company Details Section */}
        <section className="animate-fade-in">
          <CompanyForm onSave={handleCompanySave} />
        </section>

        {/* Photo Upload Section */}
        {companyDetails && (
          <section className="animate-slide-in">
            <PhotoUploader 
              onUpload={handlePhotosUpload}
              onProcess={handleProcess}
              isProcessing={isProcessing}
              photoCount={uploadedPhotos.length}
            />
          </section>
        )}

        {/* Content Preview Section */}
        {processedContent && (
          <section className="animate-fade-in">
            <ContentPreview content={processedContent} />
          </section>
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
