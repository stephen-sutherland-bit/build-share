import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Send, 
  Linkedin, 
  Image as ImageIcon, 
  Hash, 
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layout,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LayoutType {
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
  layouts: LayoutType[];
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
  const [step, setStep] = useState<'customize' | 'preview'>('customize');
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(0);
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [posting, setPosting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (isOpen && user) {
      loadConnections();
      setStep('customize');
      setSelectedLayoutIndex(0);
      setSelectedCaptionIndex(0);
      setSelectedHashtags(hashtags.slice(0, 5));
      setPreviewIndex(0);
    }
  }, [isOpen, user, hashtags]);

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

  const getLayoutPhotos = (layout: LayoutType) => {
    if (layout.type === 'Before-After' && layout.beforePhotoIndex !== undefined && layout.afterPhotoIndex !== undefined) {
      return [photos[layout.beforePhotoIndex]?.url, photos[layout.afterPhotoIndex]?.url].filter(Boolean);
    }
    if (layout.photoIndices && layout.photoIndices.length > 0) {
      return layout.photoIndices.map(i => photos[i]?.url).filter(Boolean);
    }
    return photos.slice(0, 4).map(p => p.url);
  };

  const selectedLayout = layouts[selectedLayoutIndex];
  const selectedPhotos = selectedLayout ? getLayoutPhotos(selectedLayout) : [];
  const selectedCaption = captions[selectedCaptionIndex];
  const captionText = typeof selectedCaption === 'string' ? selectedCaption : selectedCaption?.text || '';

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const postToLinkedIn = async () => {
    if (!user || !isLinkedInConnected()) {
      toast.error('Please connect your LinkedIn account first');
      return;
    }
    if (!captionText.trim()) {
      toast.error('Please select a caption');
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
            caption: captionText.trim(),
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

  const getCaptionLabel = (caption: typeof captions[0], idx: number) => {
    if (typeof caption === 'object' && caption.platform) {
      return caption.platform;
    }
    return `Caption ${idx + 1}`;
  };

  const getCaptionPreview = (caption: typeof captions[0]) => {
    const text = typeof caption === 'string' ? caption : caption.text;
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Quick Post
              </DialogTitle>
              <DialogDescription className="mt-1">
                {step === 'customize' ? 'Pick your layout, caption & hashtags' : 'Review and post'}
              </DialogDescription>
            </div>
            {/* Simple step indicator */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-8 rounded-full transition-colors ${step === 'customize' ? 'bg-primary' : 'bg-primary/30'}`} />
              <div className={`h-2 w-8 rounded-full transition-colors ${step === 'preview' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <AnimatePresence mode="wait">
            {step === 'customize' && (
              <motion.div
                key="customize"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-8"
              >
                {/* Layout Selection */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Layout className="h-4 w-4 text-primary" />
                    Select Layout
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {layouts.map((layout, idx) => {
                      const layoutPhotos = getLayoutPhotos(layout);
                      const isSelected = selectedLayoutIndex === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedLayoutIndex(idx);
                            setPreviewIndex(0);
                          }}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border/50 hover:border-primary/50'
                          }`}
                        >
                          {/* Layout thumbnail */}
                          <div className="absolute inset-0 grid grid-cols-2 gap-0.5 p-0.5 bg-muted/50">
                            {layoutPhotos.slice(0, 4).map((url, i) => (
                              <div key={i} className="relative overflow-hidden rounded-sm">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                          {/* Overlay */}
                          <div className={`absolute inset-0 flex flex-col justify-end p-2 transition-opacity ${
                            isSelected ? 'bg-gradient-to-t from-primary/80 to-transparent' : 'bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100'
                          }`}>
                            <span className="text-xs font-medium text-white truncate">{layout.type}</span>
                            <span className="text-[10px] text-white/70">{layoutPhotos.length} photos</span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="h-5 w-5 text-white drop-shadow-md" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Caption Selection */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Choose Caption
                  </div>
                  <RadioGroup 
                    value={String(selectedCaptionIndex)} 
                    onValueChange={(v) => setSelectedCaptionIndex(Number(v))}
                    className="space-y-2"
                  >
                    {captions.map((caption, idx) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedCaptionIndex === idx 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                        }`}
                      >
                        <RadioGroupItem value={String(idx)} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{getCaptionLabel(caption, idx)}</span>
                            {selectedCaptionIndex === idx && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Selected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {getCaptionPreview(caption)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </section>

                {/* Hashtag Selection */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Hash className="h-4 w-4 text-primary" />
                      Select Hashtags
                    </div>
                    <span className="text-xs text-muted-foreground">{selectedHashtags.length} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hashtags.map((tag, idx) => {
                      const isSelected = selectedHashtags.includes(tag);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleHashtag(tag)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          #{tag.replace(/^#/, '')}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </motion.div>
            )}

            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-6"
              >
                {/* Connection Status */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="h-10 w-10 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center">
                    <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">LinkedIn</span>
                      {loadingConnections ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isLinkedInConnected() ? (
                        <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
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
                        : 'Connect in Settings'}
                    </p>
                  </div>
                </div>

                {/* Post Preview Card */}
                <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
                  {/* Photo Preview */}
                  {selectedPhotos.length > 0 && (
                    <div className="relative aspect-video bg-muted">
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
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4 text-white" />
                          </button>
                          <button
                            onClick={() => setPreviewIndex(i => Math.min(selectedPhotos.length - 1, i + 1))}
                            disabled={previewIndex === selectedPhotos.length - 1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:opacity-30 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4 text-white" />
                          </button>
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {selectedPhotos.map((_, i) => (
                              <button 
                                key={i}
                                onClick={() => setPreviewIndex(i)}
                                className={`h-2 w-2 rounded-full transition-colors ${i === previewIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
                              />
                            ))}
                          </div>
                          <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/50 text-white text-xs font-medium">
                            {previewIndex + 1} / {selectedPhotos.length}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Caption & Hashtags Preview */}
                  <div className="p-4 space-y-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{captionText}</p>
                    {selectedHashtags.length > 0 && (
                      <p className="text-sm text-primary">
                        {selectedHashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{selectedPhotos.length} photos</strong> • 
                    <strong className="text-foreground"> {captionText.length}</strong> chars • 
                    <strong className="text-foreground"> {selectedHashtags.length}</strong> hashtags
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border/50 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            {step === 'customize' ? (
              <>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button 
                  onClick={() => setStep('preview')}
                  className="gradient-primary"
                  disabled={layouts.length === 0 || captions.length === 0}
                >
                  Preview Post
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setStep('customize')}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Edit
                </Button>
                <Button 
                  onClick={postToLinkedIn}
                  disabled={posting || !isLinkedInConnected()}
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white min-w-[160px]"
                >
                  {posting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Linkedin className="mr-2 h-4 w-4" />
                      Post to LinkedIn
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
