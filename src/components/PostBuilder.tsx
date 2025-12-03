import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Send, 
  Linkedin, 
  Image as ImageIcon, 
  Hash, 
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Layout {
  type: string;
  description?: string;
  photoIndices?: number[];
  beforePhotoIndex?: number;
  afterPhotoIndex?: number;
}

interface PostBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Array<{ url: string }>;
  captions: Array<{ platform?: string; text: string } | string>;
  hashtags: string[];
  layouts: Layout[];
}

interface SocialConnection {
  platform: string;
  platform_username: string | null;
  expires_at: string | null;
}

export const PostBuilder = ({ 
  isOpen, 
  onClose, 
  photos, 
  captions, 
  hashtags, 
  layouts 
}: PostBuilderProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'layout' | 'content' | 'preview'>('layout');
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [posting, setPosting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (isOpen && user) {
      loadConnections();
      // Reset state when opening
      setStep('layout');
      setSelectedLayout(null);
      setSelectedPhotos([]);
      
      // Set default caption (LinkedIn version if available)
      const linkedInCaption = captions.find(c => 
        typeof c === 'object' && c.platform?.toLowerCase() === 'linkedin'
      );
      if (linkedInCaption && typeof linkedInCaption === 'object') {
        setCaption(linkedInCaption.text);
      } else if (captions.length > 0) {
        setCaption(typeof captions[0] === 'string' ? captions[0] : captions[0].text);
      }
      
      // Select first 5 hashtags by default
      setSelectedHashtags(hashtags.slice(0, 5));
    }
  }, [isOpen, user, captions, hashtags]);

  const loadConnections = async () => {
    if (!user) return;
    setLoadingConnections(true);

    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('platform, platform_username, expires_at')
        .eq('user_id', user.id);

      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error('Error loading connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const getLinkedInConnection = () => connections.find(c => c.platform === 'linkedin');
  const isLinkedInConnected = () => {
    const conn = getLinkedInConnection();
    if (!conn) return false;
    if (conn.expires_at && new Date(conn.expires_at) < new Date()) return false;
    return true;
  };

  const handleLayoutSelect = (layout: Layout) => {
    setSelectedLayout(layout);
    
    // Auto-select photos based on layout
    let photoUrls: string[] = [];
    if (layout.type === 'Before-After' && layout.beforePhotoIndex !== undefined && layout.afterPhotoIndex !== undefined) {
      photoUrls = [photos[layout.beforePhotoIndex]?.url, photos[layout.afterPhotoIndex]?.url].filter(Boolean);
    } else if (layout.photoIndices && layout.photoIndices.length > 0) {
      photoUrls = layout.photoIndices.map(i => photos[i]?.url).filter(Boolean);
    } else {
      // Default to first few photos
      photoUrls = photos.slice(0, 4).map(p => p.url);
    }
    
    setSelectedPhotos(photoUrls);
    setStep('content');
  };

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const togglePhoto = (url: string) => {
    setSelectedPhotos(prev => 
      prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const postToLinkedIn = async () => {
    if (!user || !isLinkedInConnected()) {
      toast.error('Please connect your LinkedIn account first');
      return;
    }

    if (!caption.trim()) {
      toast.error('Please enter a caption');
      return;
    }

    setPosting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/linkedin-post`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            caption: caption.trim(),
            hashtags: selectedHashtags,
            imageUrls: selectedPhotos
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Successfully posted to LinkedIn!');
        onClose();
      } else {
        toast.error(data.error || 'Failed to post to LinkedIn');
      }
    } catch (err) {
      console.error('Post error:', err);
      toast.error('Failed to post to LinkedIn');
    } finally {
      setPosting(false);
    }
  };

  const getLayoutPhotoCount = (layout: Layout) => {
    if (layout.type === 'Before-After') return 2;
    if (layout.photoIndices) return layout.photoIndices.length;
    return 4;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Post to Social Media
          </DialogTitle>
          <DialogDescription>
            {step === 'layout' && 'Select a layout for your post'}
            {step === 'content' && 'Customize your post content'}
            {step === 'preview' && 'Review and post'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4 border-b border-border/50">
          {['layout', 'content', 'preview'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div 
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s 
                    ? 'bg-primary text-primary-foreground' 
                    : i < ['layout', 'content', 'preview'].indexOf(step)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  i < ['layout', 'content', 'preview'].indexOf(step)
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 px-1">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Layout */}
            {step === 'layout' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="py-4 space-y-4"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {layouts.map((layout, index) => (
                    <button
                      key={index}
                      onClick={() => handleLayoutSelect(layout)}
                      className="p-4 rounded-lg border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{layout.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {layout.description || `${getLayoutPhotoCount(layout)} photos`}
                      </p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {getLayoutPhotoCount(layout)} photos
                      </Badge>
                    </button>
                  ))}
                </div>

                {layouts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No layouts available. Process your photos first.
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Customize Content */}
            {step === 'content' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="py-4 space-y-6"
              >
                {/* Selected Photos */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Selected Photos ({selectedPhotos.length})
                  </Label>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => togglePhoto(photo.url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          selectedPhotos.includes(photo.url)
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent opacity-50 hover:opacity-100'
                        }`}
                      >
                        <img 
                          src={photo.url} 
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedPhotos.includes(photo.url) && (
                          <div className="absolute top-1 right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Caption
                  </Label>
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write your post caption..."
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {caption.length} characters
                  </p>
                </div>

                {/* Hashtags */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Hashtags ({selectedHashtags.length} selected)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, index) => (
                      <button
                        key={index}
                        onClick={() => toggleHashtag(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          selectedHashtags.includes(tag)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        #{tag.replace(/^#/, '')}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Preview & Post */}
            {step === 'preview' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="py-4 space-y-6"
              >
                {/* Connection Status */}
                <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center">
                      <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">LinkedIn</span>
                        {loadingConnections ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isLinkedInConnected() ? (
                          <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Not Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isLinkedInConnected() 
                          ? getLinkedInConnection()?.platform_username || 'Ready to post'
                          : 'Connect your account in Settings'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Post Preview */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Post Preview
                  </Label>
                  <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-4">
                    {/* Photo Preview */}
                    {selectedPhotos.length > 0 && (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={selectedPhotos[previewIndex]} 
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        {selectedPhotos.length > 1 && (
                          <>
                            <button
                              onClick={() => setPreviewIndex(i => Math.max(0, i - 1))}
                              disabled={previewIndex === 0}
                              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center disabled:opacity-30"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setPreviewIndex(i => Math.min(selectedPhotos.length - 1, i + 1))}
                              disabled={previewIndex === selectedPhotos.length - 1}
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center disabled:opacity-30"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                              {selectedPhotos.map((_, i) => (
                                <div 
                                  key={i}
                                  className={`h-1.5 w-1.5 rounded-full ${i === previewIndex ? 'bg-white' : 'bg-white/50'}`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Caption Preview */}
                    <div className="space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{caption}</p>
                      {selectedHashtags.length > 0 && (
                        <p className="text-sm text-primary">
                          {selectedHashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === 'layout') onClose();
              else if (step === 'content') setStep('layout');
              else setStep('content');
            }}
          >
            {step === 'layout' ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex gap-2">
            {step === 'content' && (
              <Button onClick={() => setStep('preview')}>
                Continue to Preview
              </Button>
            )}
            {step === 'preview' && (
              <Button
                onClick={postToLinkedIn}
                disabled={posting || !isLinkedInConnected() || !caption.trim()}
                className="bg-[#0A66C2] hover:bg-[#004182] text-white"
              >
                {posting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Linkedin className="h-4 w-4 mr-2" />
                    Post to LinkedIn
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
