import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ChevronLeft, ChevronRight, Play, Pause, SkipBack, SkipForward, Video, Trash2, Plus, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { VideoExporter } from "./VideoExporter";
import { LayoutEditMode } from "./LayoutEditMode";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface Layout {
  type: string;
  description?: string;
  preview?: string;
  beforePhotoIndex?: number;
  afterPhotoIndex?: number;
  photoIndices?: number[];
}

interface LayoutPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: Layout;
  photos: Array<{ url: string; timestamp?: string }>;
  onUpdateLayout?: (updatedLayout: Layout) => void;
  companyDetails?: {
    name: string;
    description: string;
  };
}

export const LayoutPreviewModal = ({ isOpen, onClose, layout, photos, onUpdateLayout, companyDetails }: LayoutPreviewModalProps) => {
  const [editableLayout, setEditableLayout] = useState<Layout>(layout);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  useEffect(() => {
    setEditableLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
    }
  }, [isOpen]);

  const layoutType = editableLayout.type.toLowerCase();
  const isBeforeAfter = layoutType.includes('before') || layoutType.includes('after');
  const isCarousel = layoutType.includes('carousel');
  const isGrid = layoutType.includes('grid');
  const isHighlight = layoutType.includes('highlight') || layoutType.includes('single');
  const isSlideshow = layoutType.includes('slideshow') || layoutType.includes('video');
  const isCollage = layoutType.includes('collage');
  const isTriptych = layoutType.includes('triptych');
  const isStory = layoutType.includes('story') || layoutType.includes('vertical');

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showVideoExporter, setShowVideoExporter] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getLayoutPhotos = () => {
    if (isBeforeAfter) {
      const beforeIdx = editableLayout.beforePhotoIndex ?? 0;
      const afterIdx = editableLayout.afterPhotoIndex ?? photos.length - 1;
      return [photos[beforeIdx], photos[afterIdx]].filter(Boolean);
    }
    if (editableLayout.photoIndices) {
      return editableLayout.photoIndices.map(idx => photos[idx]).filter(Boolean);
    }
    return photos;
  };

  const getPhotoIndices = () => {
    if (isBeforeAfter) {
      return [editableLayout.beforePhotoIndex ?? 0, editableLayout.afterPhotoIndex ?? photos.length - 1];
    }
    if (editableLayout.photoIndices) {
      return editableLayout.photoIndices;
    }
    return [];
  };

  const layoutPhotos = getLayoutPhotos();
  const photoIndices = getPhotoIndices();
  const hasExplicitPhotoSelection = editableLayout.photoIndices || isBeforeAfter;
  const availablePhotos = hasExplicitPhotoSelection 
    ? photos.map((photo, idx) => ({ photo, idx })).filter(({ idx }) => !photoIndices.includes(idx))
    : [];

  const addPhotoToLayout = (photoIndex: number) => {
    let updatedLayout: Layout;
    if (editableLayout.photoIndices) {
      updatedLayout = { ...editableLayout, photoIndices: [...editableLayout.photoIndices, photoIndex] };
    } else {
      const currentIndices = photos.map((_, i) => i);
      updatedLayout = { ...editableLayout, photoIndices: [...currentIndices, photoIndex] };
    }
    setEditableLayout(updatedLayout);
    onUpdateLayout?.(updatedLayout);
    toast.success("Photo added to layout");
  };

  const removePhotoFromLayout = (indexInLayout: number) => {
    if (layoutPhotos.length <= 1) {
      toast.error("Cannot remove the last photo from this layout");
      return;
    }
    let updatedLayout: Layout;
    if (isBeforeAfter) {
      toast.error("Before/After layout requires exactly 2 photos");
      return;
    } else if (editableLayout.photoIndices) {
      const newIndices = editableLayout.photoIndices.filter((_, i) => i !== indexInLayout);
      updatedLayout = { ...editableLayout, photoIndices: newIndices };
    } else {
      const allIndices = photos.map((_, i) => i).filter((_, i) => i !== indexInLayout);
      updatedLayout = { ...editableLayout, photoIndices: allIndices };
    }
    setEditableLayout(updatedLayout);
    onUpdateLayout?.(updatedLayout);
    if (slideshowIndex >= updatedLayout.photoIndices!.length) {
      setSlideshowIndex(Math.max(0, updatedLayout.photoIndices!.length - 1));
    }
    if (carouselIndex >= updatedLayout.photoIndices!.length) {
      setCarouselIndex(Math.max(0, updatedLayout.photoIndices!.length - 1));
    }
    toast.success("Photo removed from layout");
  };

  useEffect(() => {
    if (isSlideshow && isPlaying && layoutPhotos.length > 1) {
      intervalRef.current = setInterval(() => {
        setSlideshowIndex(prev => (prev + 1) % layoutPhotos.length);
      }, 2000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSlideshow, isPlaying, layoutPhotos.length]);

  const downloadLayoutPhotos = async () => {
    const toastId = toast.loading(`Preparing ${layoutPhotos.length} photos...`);
    try {
      if (layoutPhotos.length === 1) {
        const response = await fetch(layoutPhotos[0].url);
        const blob = await response.blob();
        saveAs(blob, `${layout.type.replace(/\s/g, '-')}-photo.jpg`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < layoutPhotos.length; i++) {
          const response = await fetch(layoutPhotos[i].url);
          const blob = await response.blob();
          zip.file(`${String(i + 1).padStart(2, '0')}_photo.jpg`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${layout.type.replace(/\s/g, '-')}-photos.zip`);
      }
      toast.success(`Downloaded ${layoutPhotos.length} photo${layoutPhotos.length > 1 ? 's' : ''}!`, { id: toastId });
    } catch (error) {
      toast.error("Download failed. Try again.", { id: toastId });
    }
  };

  const handleLayoutUpdate = (updatedLayout: Layout) => {
    setEditableLayout(updatedLayout);
    onUpdateLayout?.(updatedLayout);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-display font-bold capitalize">
              {editableLayout.type} Layout
              {isEditMode && <span className="text-primary ml-2 text-base">(Editing)</span>}
            </h2>
            <p className="text-sm text-muted-foreground">{editableLayout.description || editableLayout.preview}</p>
          </div>
          <div className="flex gap-2">
            {onUpdateLayout && (
              <Button 
                variant={isEditMode ? "default" : "outline"} 
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </>
                )}
              </Button>
            )}
            {!isEditMode && (
              <Button variant="outline" onClick={downloadLayoutPhotos}>
                <Download className="mr-2 h-4 w-4" />
                Download {layoutPhotos.length > 1 ? `(${layoutPhotos.length})` : ''}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Edit Mode */}
          {isEditMode && onUpdateLayout && (
            <LayoutEditMode
              layout={editableLayout}
              photos={photos}
              onUpdateLayout={handleLayoutUpdate}
              companyDetails={companyDetails}
            />
          )}

          {/* View Mode Content */}
          {!isEditMode && (
            <>
              {/* Before/After with Interactive Slider */}
              {isBeforeAfter && photos.length >= 2 && (
                <div className="max-w-2xl mx-auto">
                  <BeforeAfterSlider
                    beforeImage={photos[editableLayout.beforePhotoIndex ?? 0]?.url}
                    afterImage={photos[editableLayout.afterPhotoIndex ?? photos.length - 1]?.url}
                  />
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Drag the slider to compare before and after
                  </p>
                </div>
              )}

              {/* Slideshow with Auto-Play */}
              {isSlideshow && (
                <div className="space-y-4">
                  <div className="relative aspect-video max-w-3xl mx-auto rounded-xl overflow-hidden bg-black">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={slideshowIndex}
                        src={layoutPhotos[slideshowIndex]?.url}
                        alt={`Slide ${slideshowIndex + 1}`}
                        className="w-full h-full object-contain"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5 }}
                      />
                    </AnimatePresence>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <motion.div 
                        className="h-full bg-primary"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'linear' }}
                        key={slideshowIndex}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setSlideshowIndex(prev => Math.max(0, prev - 1))}>
                      <SkipBack className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setIsPlaying(!isPlaying)}>
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSlideshowIndex(prev => Math.min(layoutPhotos.length - 1, prev + 1))}>
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex gap-2 justify-center flex-wrap">
                    {layoutPhotos.slice(0, 20).map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <motion.button
                          onClick={() => setSlideshowIndex(idx)}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                            idx === slideshowIndex ? "border-primary ring-2 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                          whileHover={{ scale: 1.05 }}
                        >
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </motion.button>
                        {onUpdateLayout && layoutPhotos.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removePhotoFromLayout(idx); }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive/90"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {layoutPhotos.length > 20 && (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                        +{layoutPhotos.length - 20}
                      </div>
                    )}
                  </div>

                  <p className="text-center text-sm text-primary font-medium">
                    📹 Ready for video/reel export • {layoutPhotos.length} photos in sequence
                  </p>
                  
                  <div className="flex justify-center">
                    <Button onClick={() => setShowVideoExporter(true)} className="gradient-primary" size="lg">
                      <Video className="mr-2 h-5 w-5" />
                      Create MP4 Video
                    </Button>
                  </div>
                </div>
              )}

              <VideoExporter isOpen={showVideoExporter} onClose={() => setShowVideoExporter(false)} photos={layoutPhotos} />

              {/* Carousel with Navigation */}
              {isCarousel && !isBeforeAfter && !isSlideshow && (
                <div className="space-y-4">
                  <div className="relative aspect-square max-w-2xl mx-auto group">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={carouselIndex}
                        src={layoutPhotos[carouselIndex]?.url}
                        alt={`Carousel ${carouselIndex + 1}`}
                        className="w-full h-full object-cover rounded-xl"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                      />
                    </AnimatePresence>
                    {onUpdateLayout && layoutPhotos.length > 1 && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={() => removePhotoFromLayout(carouselIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {carouselIndex > 0 && (
                      <Button variant="secondary" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg" onClick={() => setCarouselIndex(prev => prev - 1)}>
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                    )}
                    {carouselIndex < layoutPhotos.length - 1 && (
                      <Button variant="secondary" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full shadow-lg" onClick={() => setCarouselIndex(prev => prev + 1)}>
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    )}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {layoutPhotos.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCarouselIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${idx === carouselIndex ? "bg-white w-6" : "bg-white/50"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Swipe through {layoutPhotos.length} photos • Perfect for Instagram carousel
                  </p>
                </div>
              )}

              {/* Grid View */}
              {isGrid && !isBeforeAfter && !isCarousel && !isSlideshow && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {layoutPhotos.map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <motion.img
                          src={photo.url}
                          alt={`Grid ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded-xl"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                        />
                        {onUpdateLayout && layoutPhotos.length > 1 && (
                          <button
                            onClick={() => removePhotoFromLayout(idx)}
                            className="absolute top-2 right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive/90"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">{layoutPhotos.length}-photo grid layout</p>
                </div>
              )}

              {/* Highlight/Single View */}
              {isHighlight && !isBeforeAfter && !isCarousel && !isGrid && !isSlideshow && !isCollage && !isTriptych && !isStory && (
                <div className="max-w-3xl mx-auto">
                  <motion.img
                    src={layoutPhotos[0]?.url}
                    alt="Highlight"
                    className="w-full aspect-video object-cover rounded-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  />
                  <p className="text-center text-sm text-muted-foreground mt-4">Hero image • Best shot for maximum impact</p>
                </div>
              )}

              {/* Collage View */}
              {isCollage && (
                <div className="space-y-4 max-w-3xl mx-auto">
                  <div className="grid grid-cols-3 grid-rows-2 gap-2 aspect-[4/3]">
                    <div className="col-span-2 row-span-2 relative group rounded-xl overflow-hidden">
                      <motion.img src={layoutPhotos[0]?.url} alt="Main" className="w-full h-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                      {onUpdateLayout && layoutPhotos.length > 1 && (
                        <button onClick={() => removePhotoFromLayout(0)} className="absolute top-2 right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {layoutPhotos.slice(1, 4).map((photo, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden">
                        <motion.img src={photo.url} alt={`Supporting ${idx + 1}`} className="w-full h-full object-cover" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (idx + 1) * 0.1 }} />
                        {onUpdateLayout && layoutPhotos.length > 1 && (
                          <button onClick={() => removePhotoFromLayout(idx + 1)} className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">Feature collage • Perfect for LinkedIn posts</p>
                </div>
              )}

              {/* Triptych View */}
              {isTriptych && (
                <div className="space-y-4 max-w-4xl mx-auto">
                  <div className="flex gap-2 aspect-[3/1]">
                    {layoutPhotos.slice(0, 3).map((photo, idx) => (
                      <div key={idx} className="flex-1 relative group rounded-xl overflow-hidden">
                        <motion.img
                          src={photo.url}
                          alt={`Panel ${idx + 1}`}
                          className="w-full h-full object-cover"
                          initial={{ opacity: 0, x: idx === 0 ? -20 : idx === 2 ? 20 : 0 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.15 }}
                        />
                        {onUpdateLayout && layoutPhotos.length > 1 && (
                          <button onClick={() => removePhotoFromLayout(idx)} className="absolute top-2 right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                          {idx === 0 ? 'Start' : idx === 1 ? 'Progress' : 'Result'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">Three-panel story • Shows progression beautifully</p>
                </div>
              )}

              {/* Story/Vertical View */}
              {isStory && (
                <div className="space-y-4 flex flex-col items-center">
                  <div className="w-72 aspect-[9/16] relative group rounded-2xl overflow-hidden shadow-xl border-4 border-muted">
                    <motion.img src={layoutPhotos[0]?.url} alt="Story" className="w-full h-full object-cover" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} />
                    {onUpdateLayout && (
                      <button onClick={() => removePhotoFromLayout(0)} className="absolute top-3 right-3 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">Vertical format • Optimized for Instagram & Facebook Stories</p>
                </div>
              )}

              {/* Add Photos Section */}
              {onUpdateLayout && !isBeforeAfter && hasExplicitPhotoSelection && availablePhotos.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold">Add Photos</h3>
                      <p className="text-xs text-muted-foreground">{availablePhotos.length} photos available to add</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowAddPhotos(!showAddPhotos)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {showAddPhotos ? 'Hide' : 'Show'} Photos
                    </Button>
                  </div>
                  <AnimatePresence>
                    {showAddPhotos && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto p-2 bg-muted/30 rounded-xl">
                          {availablePhotos.map(({ photo, idx }) => (
                            <motion.button
                              key={idx}
                              onClick={() => addPhotoToLayout(idx)}
                              className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all group"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <img src={photo.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                                <Plus className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg" />
                              </div>
                              <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white text-center py-0.5">#{idx + 1}</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Prompt to use Edit Mode */}
              {onUpdateLayout && !hasExplicitPhotoSelection && (
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground">Click <strong>Edit</strong> to customize photos and layout type</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
