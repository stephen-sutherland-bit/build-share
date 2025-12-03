import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Share2, Download, Copy, Instagram, Linkedin, Facebook, Twitter, ChevronDown, RotateCcw, Save, CheckCircle, LayoutGrid, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PhotoLightbox } from "./PhotoLightbox";
import { LayoutPreviewModal } from "./LayoutPreviewModal";
import { SortablePhoto } from "./SortablePhoto";
import { LayoutCard } from "./LayoutCard";
import { PostBuilder } from "./PostBuilder";

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
  onSave?: () => void;
  currentProjectName?: string;
  isSaved?: boolean;
}

export const ContentPreview = ({ content, onSave, currentProjectName, isSaved }: ContentPreviewProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedLayout, setSelectedLayout] = useState<typeof content.layouts[0] | null>(null);
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState<number>(-1);
  const [isExporting, setIsExporting] = useState(false);
  const [postBuilderOpen, setPostBuilderOpen] = useState(false);
  
  // Track edited layouts - deduplicated to one per type
  const deduplicateLayouts = (layouts: typeof content.layouts) => {
    const seenTypes = new Set<string>();
    return layouts.filter(layout => {
      const normalizedType = layout.type.toLowerCase().replace(/\s+/g, '');
      // Normalize type names to group similar layouts
      let typeKey = normalizedType;
      if (normalizedType.includes('before') || normalizedType.includes('after')) typeKey = 'beforeafter';
      else if (normalizedType.includes('carousel')) typeKey = 'carousel';
      else if (normalizedType.includes('grid')) typeKey = 'grid';
      else if (normalizedType.includes('highlight') || normalizedType.includes('single')) typeKey = 'highlight';
      else if (normalizedType.includes('slideshow')) typeKey = 'slideshow';
      
      if (seenTypes.has(typeKey)) return false;
      seenTypes.add(typeKey);
      return true;
    });
  };
  
  const [editedLayouts, setEditedLayouts] = useState(() => deduplicateLayouts(content.layouts));
  
  // Track reordered photos with their original indices
  const [orderedPhotos, setOrderedPhotos] = useState(() => 
    content.photos.map((photo, idx) => ({ ...photo, id: `photo-${idx}`, originalIndex: idx }))
  );

  // Update when content changes
  useEffect(() => {
    setOrderedPhotos(content.photos.map((photo, idx) => ({ ...photo, id: `photo-${idx}`, originalIndex: idx })));
  }, [content.photos]);

  // Update layouts when content changes
  useEffect(() => {
    setEditedLayouts(deduplicateLayouts(content.layouts));
  }, [content.layouts]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setOrderedPhotos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        toast.success(`Moved photo from position ${oldIndex + 1} to ${newIndex + 1}`);
        return newOrder;
      });
    }
  };

  const resetPhotoOrder = () => {
    setOrderedPhotos(content.photos.map((photo, idx) => ({ ...photo, id: `photo-${idx}`, originalIndex: idx })));
    toast.success("Photo order reset to AI-suggested order");
  };

  const handleUpdateLayout = (updatedLayout: typeof content.layouts[0]) => {
    if (selectedLayoutIndex >= 0) {
      const newLayouts = [...editedLayouts];
      newLayouts[selectedLayoutIndex] = updatedLayout;
      setEditedLayouts(newLayouts);
      setSelectedLayout(updatedLayout);
    }
  };

  const hasReorderedPhotos = orderedPhotos.some((photo, idx) => photo.originalIndex !== idx);

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
      
      // Add all photos in user's reordered sequence
      for (let i = 0; i < orderedPhotos.length; i++) {
        const response = await fetch(orderedPhotos[i].url);
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
      toast.success(`Exported ${orderedPhotos.length} photos + captions + hashtags!`, { id: toastId });
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
      <Card className="shadow-soft hover:shadow-medium transition-smooth border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-display tracking-tight">Your Content is Ready!</CardTitle>
              <CardDescription className="text-sm">
                Review and export your social media content
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {onSave && (
                <Button 
                  variant={isSaved ? "outline" : "default"}
                  onClick={onSave}
                  className={`transition-smooth ${isSaved 
                    ? "border-green-500/30 text-green-600 hover:bg-green-500/10" 
                    : "bg-green-600 hover:bg-green-700 shadow-soft hover:shadow-medium"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Project
                    </>
                  )}
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleExportAll} 
                disabled={isExporting}
                className="border-border/50 hover:bg-muted/50 transition-smooth"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export All"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gradient-primary shadow-soft hover:shadow-medium hover:opacity-95 transition-smooth">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share to Social
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 shadow-strong border-border/50">
                  <DropdownMenuItem onClick={() => setPostBuilderOpen(true)} className="cursor-pointer focus:bg-muted">
                    <Send className="mr-2 h-4 w-4 text-primary" />
                    Post Directly
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => copyForPlatform('instagram')} className="cursor-pointer focus:bg-muted">
                    <Instagram className="mr-2 h-4 w-4 text-pink-500" />
                    Copy for Instagram
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('linkedin')} className="cursor-pointer focus:bg-muted">
                    <Linkedin className="mr-2 h-4 w-4 text-blue-600" />
                    Copy for LinkedIn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('facebook')} className="cursor-pointer focus:bg-muted">
                    <Facebook className="mr-2 h-4 w-4 text-blue-500" />
                    Copy for Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyForPlatform('twitter')} className="cursor-pointer focus:bg-muted">
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
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="photos" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-soft transition-smooth">Photos</TabsTrigger>
              <TabsTrigger value="layouts" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-soft transition-smooth">Layouts</TabsTrigger>
              <TabsTrigger value="captions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-soft transition-smooth">Captions</TabsTrigger>
              <TabsTrigger value="hashtags" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-soft transition-smooth">Hashtags</TabsTrigger>
            </TabsList>
            
            <TabsContent value="photos" className="space-y-4 mt-6">
              {hasReorderedPhotos && (
                <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    Photos reordered — new order will be used for exports
                  </p>
                  <Button variant="outline" size="sm" onClick={resetPhotoOrder} className="border-amber-500/30 hover:bg-amber-500/10">
                    <RotateCcw className="mr-2 h-3 w-3" />
                    Reset
                  </Button>
                </div>
              )}
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={orderedPhotos.map(p => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {orderedPhotos.map((photo, idx) => (
                      <SortablePhoto
                        key={photo.id}
                        id={photo.id}
                        photo={photo}
                        index={idx}
                        originalIndex={photo.originalIndex}
                        onDownload={downloadPhoto}
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              
              <p className="text-sm text-muted-foreground text-center pt-2">
                {orderedPhotos.length} photos • Drag to reorder • Click to preview
              </p>
            </TabsContent>
            
            <TabsContent value="layouts" className="space-y-6 mt-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Layout Options</h3>
                  <p className="text-sm text-muted-foreground">
                    Click any layout to preview, edit photos, or export
                  </p>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                  {editedLayouts.length} layouts available
                </div>
              </div>

              {/* Layout Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editedLayouts.map((layout, idx) => (
                  <LayoutCard
                    key={idx}
                    layout={layout}
                    photos={content.photos}
                    index={idx}
                    onClick={() => {
                      setSelectedLayout(layout);
                      setSelectedLayoutIndex(idx);
                    }}
                  />
                ))}
              </div>

              {/* Empty State */}
              {editedLayouts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No layouts available</p>
                  <p className="text-sm">Upload photos to generate AI layout suggestions</p>
                </div>
              )}

              {/* Tip */}
              <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pro tip</p>
                  <p className="text-xs text-muted-foreground">
                    You can add or remove photos from any layout. Click a layout to open the editor.
                  </p>
                </div>
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
            photos={orderedPhotos}
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
          onClose={() => {
            setSelectedLayout(null);
            setSelectedLayoutIndex(-1);
          }}
          layout={selectedLayout}
          photos={orderedPhotos}
          onUpdateLayout={handleUpdateLayout}
        />
      )}

      {/* Post Builder Modal */}
      <PostBuilder
        isOpen={postBuilderOpen}
        onClose={() => setPostBuilderOpen(false)}
        photos={orderedPhotos}
        captions={content.captions}
        hashtags={content.hashtags}
        layouts={editedLayouts}
      />
    </>
  );
};