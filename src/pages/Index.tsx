import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PhotoUploader } from "@/components/PhotoUploader";
import { ContentPreview } from "@/components/ContentPreview";
import { ProjectSelector } from "@/components/ProjectSelector";
import { SaveProjectDialog } from "@/components/SaveProjectDialog";
import { Sparkles, Zap, Layout } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, Project } from "@/hooks/useProjects";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-construction.jpg";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

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
  layouts: Array<{ 
    type: string; 
    description?: string;
    preview?: string;
    beforePhotoIndex?: number;
    afterPhotoIndex?: number;
    photoIndices?: number[];
  }>;
}

const Index = () => {
  const { user } = useAuth();
  const { projects, loading: loadingProjects, saveProject, deleteProject } = useProjects();
  
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [processingProgress, setProcessingProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
  } | null>(null);

  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadCompanyDetails();
    }
  }, [user]);

  // Reset saved state when content changes
  useEffect(() => {
    if (processedContent) {
      setIsSaved(false);
    }
  }, [processedContent]);

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

  const handlePhotosUpload = (files: File[], append: boolean = false) => {
    if (append && uploadedPhotos.length > 0) {
      const newTotal = uploadedPhotos.length + files.length;
      const MAX_PHOTOS = 80;
      if (newTotal > MAX_PHOTOS) {
        const canAdd = MAX_PHOTOS - uploadedPhotos.length;
        if (canAdd > 0) {
          setUploadedPhotos([...uploadedPhotos, ...files.slice(0, canAdd)]);
          toast.warning(`Added ${canAdd} photos. Maximum ${MAX_PHOTOS} reached.`);
        } else {
          toast.error(`Maximum ${MAX_PHOTOS} photos already uploaded.`);
        }
      } else {
        setUploadedPhotos([...uploadedPhotos, ...files]);
        toast.success(`Added ${files.length} more photos!`);
      }
    } else {
      setUploadedPhotos(files);
      // Clear previous project when uploading new photos
      setCurrentProjectId(null);
      setCurrentProjectName('');
      setIsSaved(false);
      toast.success(`${files.length} photos uploaded!`);
    }
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

  const handleLoadProject = (project: Project) => {
    setProcessedContent({
      photos: project.photos,
      captions: project.captions,
      hashtags: project.hashtags,
      layouts: project.layouts,
    });
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setIsSaved(true);
    setUploadedPhotos([]); // Clear uploaded files since we're loading from saved
    toast.success(`Loaded "${project.name}"`);
  };

  const handleSaveClick = () => {
    setSaveDialogOpen(true);
  };

  const handleSaveProject = async (name: string) => {
    if (!processedContent || !companyDetails) return;
    
    const savedId = await saveProject(name, processedContent, companyDetails, currentProjectId || undefined);
    if (savedId) {
      setCurrentProjectId(savedId);
      setCurrentProjectName(name);
      setIsSaved(true);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const deleted = await deleteProject(id);
    if (deleted && id === currentProjectId) {
      // If we deleted the currently loaded project, clear the state
      setCurrentProjectId(null);
      setCurrentProjectName('');
      setIsSaved(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <motion.div 
            className="max-w-3xl mx-auto text-center space-y-8"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.h1 
              className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-foreground tracking-tighter leading-[1.1]"
              variants={fadeInUp}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              Transform Job Photos into 
              <span className="block gradient-text-primary mt-3">
                Social Media Gold
              </span>
            </motion.h1>
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Upload your construction project photos and let AI create engaging social media content with captions, hashtags, and professional layouts.
            </motion.p>
            <motion.div 
              className="flex flex-wrap justify-center gap-8 pt-6"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 group">
                <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center transition-spring group-hover:scale-105 group-hover:bg-accent/15">
                  <Sparkles className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-semibold tracking-tight">AI-Powered</span>
              </div>
              <div className="flex items-center gap-3 group">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center transition-spring group-hover:scale-105 group-hover:bg-primary/15">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-semibold tracking-tight">Instant Results</span>
              </div>
              <div className="flex items-center gap-3 group">
                <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center transition-spring group-hover:scale-105 group-hover:bg-accent/15">
                  <Layout className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-semibold tracking-tight">Pro Layouts</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 space-y-10">
        {loadingCompany ? (
          <div className="text-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : !companyDetails ? (
          <div className="text-center py-16 space-y-5">
            <p className="text-lg text-muted-foreground">
              Set up your company details to start creating content.
            </p>
            <Button asChild className="gradient-primary shadow-soft hover:shadow-medium transition-smooth">
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Saved Projects Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProjectSelector
                projects={projects}
                loading={loadingProjects}
                onSelect={handleLoadProject}
                onDelete={handleDeleteProject}
              />
            </motion.section>

            {/* Photo Upload Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhotoUploader 
                onUpload={handlePhotosUpload}
                onProcess={handleProcess}
                isProcessing={isProcessing}
                photoCount={uploadedPhotos.length}
                processingProgress={processingProgress}
              />
            </motion.section>

            {/* Content Preview Section */}
            {processedContent && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <ContentPreview 
                  content={processedContent}
                  onSave={handleSaveClick}
                  currentProjectName={currentProjectName}
                  isSaved={isSaved}
                />
              </motion.section>
            )}
          </>
        )}
      </main>

      {/* Save Dialog */}
      <SaveProjectDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveProject}
        defaultName={currentProjectName}
        isUpdate={!!currentProjectId}
      />

      {/* Footer */}
      <motion.footer 
        className="mt-20 py-10 border-t border-border/50"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground tracking-tight">
            Powered by <span className="font-semibold text-foreground">BuildPost AI</span> • Transform your construction content instantly
          </p>
        </div>
      </motion.footer>
    </div>
  );
};

export default Index;
