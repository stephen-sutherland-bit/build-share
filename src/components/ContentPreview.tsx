import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Share2, Download, Copy, Instagram, Linkedin, Facebook, Twitter, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PhotoLightbox } from "./PhotoLightbox";
import { LayoutPreviewModal } from "./LayoutPreviewModal";

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

interface ContentPreviewProps {
  content: ProcessedContent;
}

export const ContentPreview = ({ content }: ContentPreviewProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedLayout, setSelectedLayout] = useState<typeof content.layouts[0] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const downloadPhoto = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      saveAs(blob, `photo-${String(index + 1).padStart(2, '0')}.jpg`);
      toast.success(`Downloaded photo ${index + 1}`);
    } catch (error) {
      toast.error("Download failed");
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    const toastId = toast.loading("Creating your content package...");
    
    try {
      const zip = new JSZip();
      const photosFolder = zip.folder("photos");
      
      // Add all photos
      for (let i = 0; i < content.photos.length; i++) {
        const response = await fetch(content.photos[i].url);
        const blob = await response.blob();
        photosFolder?.file(`${String(i + 1).padStart(2, '0')}_photo.jpg`, blob);
      }
      
      // Add captions
      const captionsText = content.captions.map((c, idx) => {
        const text = typeof c === 'string' ? c : c.text;
        const platform = typeof c === 'object' && c.platform ? c.platform : `Caption ${idx + 1}`;
        return `=== ${platform} ===\n${text}`;
      }).join('\n\n');
      zip.file("captions.txt", captionsText);
      
      // Add hashtags
      zip.file("hashtags.txt", content.hashtags.map(t => `#${t}`).join(' '));
      
      // Generate and download
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        const percent = Math.round(metadata.percent);
        if (percent % 20 === 0) {
          toast.loading(`Packing... ${percent}%`, { id: toastId });
        }
      });
      
      saveAs(zipBlob, `construction-content-${new Date().toISOString().split('T')[0]}.zip`);
      toast.success(`Exported ${content.photos.length} photos + captions + hashtags!`, { id: toastId });
    } catch (error) {
      toast.error("Export failed. Please try again.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const copyForPlatform = (platform: 'instagram' | 'linkedin' | 'facebook' | 'twitter') => {
    const caption = content.captions.find(c => {
      if (typeof c === 'object' && c.platform) {
        return c.platform.toLowerCase().includes(platform);
      }
      return false;
    });
    
    const captionText = caption 
      ? (typeof caption === 'string' ? caption : caption.text)
      : (typeof content.captions[0] === 'string' ? content.captions[0] : content.captions[0]?.text || '');
    
    let hashtags = '';
    switch (platform) {
      case 'instagram':
        hashtags = content.hashtags.slice(0, 30).map(t => `#${t}`).join(' ');
        break;
      case 'linkedin':
        hashtags = content.hashtags.slice(0, 5).map(t => `#${t}`).join(' ');
        break;
      case 'facebook':
        hashtags = content.hashtags.slice(0, 8).map(t => `#${t}`).join(' ');
        break;
      case 'twitter':
        hashtags = content.hashtags.slice(0, 3).map(t => `#${t}`).join(' ');
        break;
    }
    
    const fullText = `${captionText}\n\n${hashtags}`;
    navigator.clipboard.writeText(fullText);
    
    const platformNames = {
      instagram: 'Instagram',
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      twitter: 'X/Twitter'
    };
    
    toast.success(`Copied for ${platformNames[platform]}!`, {
      description: "Paste into your post along with your photos"
    });
  };

  return (
    <>
      <Card className="shadow-medium border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl font-display">Your Content is Ready!</CardTitle>
              <CardDescription>
                Review and export your social media content
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportAll} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export All"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gradient-primary">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share to Social
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => copyForPlatform('instagram')} className="cursor-pointer">
                    <Instagram className="mr-2 h-4 w-4 text-pink-500" />
                    Copy for Instagram
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('linkedin')} className="cursor-pointer">
                    <Linkedin className="mr-2 h-4 w-4 text-blue-600" />
                    Copy for LinkedIn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('facebook')} className="cursor-pointer">
                    <Facebook className="mr-2 h-4 w-4 text-blue-500" />
                    Copy for Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('twitter')} className="cursor-pointer">
                    <Twitter className="mr-2 h-4 w-4" />
                    Copy for X/Twitter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="photos" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="layouts">Layouts</TabsTrigger>
              <TabsTrigger value="captions">Captions</TabsTrigger>
              <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
            </TabsList>
            
            <TabsContent value="photos" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {content.photos.map((photo, idx) => (
                  <motion.div 
                    key={idx} 
                    className="relative group overflow-hidden rounded-lg border border-border hover:shadow-medium transition-all cursor-pointer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  >
                    <img 
                      src={photo.url} 
                      alt={`Construction photo ${idx + 1}`}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-end p-3">
                      <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                        #{idx + 1}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPhoto(photo.url, idx);
                        }}
                      >
                        <Download className="mr-2 h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {content.photos.length} photos organized in chronological order • Click to preview, hover to download
              </p>
            </TabsContent>
            
            <TabsContent value="layouts" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.layouts.map((layout, idx) => {
                  const layoutType = layout.type.toLowerCase();
                  const isBeforeAfter = layoutType.includes('before') || layoutType.includes('after');
                  const isCarousel = layoutType.includes('carousel');
                  const isGrid = layoutType.includes('grid');
                  const isHighlight = layoutType.includes('highlight') || layoutType.includes('single');
                  const isSlideshow = layoutType.includes('slideshow');
                  
                  return (
                    <motion.div 
                      key={idx} 
                      className="border border-border rounded-lg p-4 hover:shadow-medium hover:border-primary/50 transition-all space-y-3 cursor-pointer group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedLayout(layout)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold capitalize">{layout.type} Layout</p>
                          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to preview →
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {layout.description || layout.preview || 'AI-generated layout suggestion'}
                        </p>
                      </div>
                      
                      {/* Before/After with AI-identified indices */}
                      {isBeforeAfter && content.photos.length >= 2 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <img 
                              src={content.photos[layout.beforePhotoIndex ?? 0]?.url} 
                              alt="Before"
                              className="w-full aspect-square object-cover rounded border border-border"
                            />
                            <p className="text-xs text-center text-muted-foreground">Before</p>
                          </div>
                          <div className="space-y-1">
                            <img 
                              src={content.photos[layout.afterPhotoIndex ?? content.photos.length - 1]?.url} 
                              alt="After"
                              className="w-full aspect-square object-cover rounded border border-border"
                            />
                            <p className="text-xs text-center text-muted-foreground">After</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Slideshow with all photos for video/reel */}
                      {isSlideshow && !isBeforeAfter && (
                        <div className="space-y-2">
                          <div className="flex gap-1 overflow-x-auto pb-2">
                            {(layout.photoIndices || content.photos.map((_, i) => i)).slice(0, 12).map((photoIdx) => (
                              <img 
                                key={photoIdx}
                                src={content.photos[photoIdx]?.url} 
                                alt={`Slideshow ${photoIdx + 1}`}
                                className="h-16 w-16 object-cover rounded flex-shrink-0 border border-border"
                              />
                            ))}
                            {(layout.photoIndices?.length || content.photos.length) > 12 && (
                              <div className="h-16 w-16 flex items-center justify-center bg-muted rounded flex-shrink-0 border border-border">
                                <span className="text-xs font-medium">+{(layout.photoIndices?.length || content.photos.length) - 12}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-primary font-medium flex items-center gap-1">
                            📹 Video/Reel: {layout.photoIndices?.length || content.photos.length} photos in sequence
                          </p>
                        </div>
                      )}
                      
                      {/* Carousel with AI-suggested indices */}
                      {isCarousel && !isBeforeAfter && !isSlideshow && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {(layout.photoIndices || content.photos.slice(0, 4).map((_, i) => i)).map((photoIdx) => (
                            <img 
                              key={photoIdx}
                              src={content.photos[photoIdx]?.url} 
                              alt={`Preview ${photoIdx + 1}`}
                              className="h-24 w-24 object-cover rounded border border-border flex-shrink-0"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Highlight with AI-suggested photo */}
                      {isHighlight && !isBeforeAfter && !isCarousel && !isSlideshow && content.photos.length > 0 && (
                        <img 
                          src={content.photos[layout.photoIndices?.[0] ?? 0]?.url} 
                          alt="Highlight"
                          className="w-full aspect-video object-cover rounded border border-border"
                        />
                      )}
                      
                      {/* Grid with AI-suggested indices */}
                      {isGrid && !isBeforeAfter && !isCarousel && !isHighlight && !isSlideshow && (
                        <div className="grid grid-cols-2 gap-2">
                          {(layout.photoIndices || content.photos.slice(0, 4).map((_, i) => i)).map((photoIdx) => (
                            <img 
                              key={photoIdx}
                              src={content.photos[photoIdx]?.url} 
                              alt={`Grid ${photoIdx + 1}`}
                              className="w-full aspect-square object-cover rounded border border-border"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Fallback for unknown layout types */}
                      {!isBeforeAfter && !isCarousel && !isGrid && !isHighlight && !isSlideshow && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {(layout.photoIndices || [0, 1, 2]).map((photoIdx) => (
                            <img 
                              key={photoIdx}
                              src={content.photos[photoIdx]?.url} 
                              alt={`Photo ${photoIdx + 1}`}
                              className="h-24 w-24 object-cover rounded border border-border flex-shrink-0"
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="captions" className="space-y-4">
              {content.captions.map((caption, idx) => {
                const captionText = typeof caption === 'string' ? caption : caption.text;
                const platform = typeof caption === 'object' && caption.platform ? caption.platform : null;
                
                return (
                  <motion.div 
                    key={idx} 
                    className="border border-border rounded-lg p-4 hover:shadow-soft transition-smooth"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    {platform && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-primary px-2 py-1 bg-primary/10 rounded">
                          {platform}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm flex-1 whitespace-pre-wrap">{captionText}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(captionText)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </TabsContent>

            <TabsContent value="hashtags" className="space-y-4">
              <motion.div 
                className="border border-border rounded-lg p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex flex-wrap gap-2 mb-4">
                  {content.hashtags.map((tag, idx) => (
                    <motion.span
                      key={idx}
                      className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium cursor-pointer hover:bg-accent/20 transition-colors"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => handleCopy(`#${tag}`)}
                    >
                      #{tag}
                    </motion.span>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(content.hashtags.map(t => `#${t}`).join(' '))}
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy All Hashtags
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <PhotoLightbox
            photos={content.photos}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onDownload={downloadPhoto}
          />
        )}
      </AnimatePresence>

      {/* Layout Preview Modal */}
      {selectedLayout && (
        <LayoutPreviewModal
          isOpen={!!selectedLayout}
          onClose={() => setSelectedLayout(null)}
          layout={selectedLayout}
          photos={content.photos}
        />
      )}
    </>
  );
};