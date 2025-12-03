import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Sparkles, 
  Loader2, 
  ChevronLeft,
  ChevronRight,
  Columns2,
  Grid2X2,
  Image as ImageIcon,
  Play,
  Layers,
  LayoutGrid,
  Rows3,
  X,
  Plus,
  GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Layout {
  type: string;
  description?: string;
  preview?: string;
  beforePhotoIndex?: number;
  afterPhotoIndex?: number;
  photoIndices?: number[];
}

interface Photo {
  url: string;
  timestamp?: string;
}

interface LayoutEditModeProps {
  layout: Layout;
  photos: Photo[];
  onUpdateLayout: (updatedLayout: Layout) => void;
  companyDetails?: {
    name: string;
    description: string;
  };
}

const LAYOUT_TYPES = [
  { type: 'Before/After', icon: Columns2, minPhotos: 2, maxPhotos: 2, description: 'Transformation comparison' },
  { type: 'Carousel', icon: Layers, minPhotos: 2, maxPhotos: 10, description: 'Swipeable multi-image' },
  { type: 'Grid', icon: Grid2X2, minPhotos: 2, maxPhotos: 9, description: 'Multi-photo grid' },
  { type: 'Slideshow', icon: Play, minPhotos: 3, maxPhotos: 50, description: 'Video-ready sequence' },
  { type: 'Highlight', icon: ImageIcon, minPhotos: 1, maxPhotos: 1, description: 'Single hero image' },
  { type: 'Collage', icon: LayoutGrid, minPhotos: 3, maxPhotos: 4, description: 'Artistic combination' },
  { type: 'Triptych', icon: Rows3, minPhotos: 3, maxPhotos: 3, description: 'Three-panel story' },
  { type: 'Story', icon: Rows3, minPhotos: 1, maxPhotos: 1, description: 'Vertical format' },
];

export const LayoutEditMode = ({ layout, photos, onUpdateLayout, companyDetails }: LayoutEditModeProps) => {
  const [selectedPhotoIndices, setSelectedPhotoIndices] = useState<number[]>(() => {
    if (layout.photoIndices) return [...layout.photoIndices];
    const layoutType = layout.type.toLowerCase();
    if (layoutType.includes('before') || layoutType.includes('after')) {
      return [layout.beforePhotoIndex ?? 0, layout.afterPhotoIndex ?? photos.length - 1];
    }
    return photos.map((_, i) => i);
  });
  
  const [selectedLayoutType, setSelectedLayoutType] = useState(() => {
    const t = layout.type.toLowerCase();
    if (t.includes('before') || t.includes('after')) return 'Before/After';
    if (t.includes('carousel')) return 'Carousel';
    if (t.includes('grid')) return 'Grid';
    if (t.includes('slideshow') || t.includes('video')) return 'Slideshow';
    if (t.includes('highlight') || t.includes('single')) return 'Highlight';
    if (t.includes('collage')) return 'Collage';
    if (t.includes('triptych')) return 'Triptych';
    if (t.includes('story') || t.includes('vertical')) return 'Story';
    return 'Carousel';
  });
  
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Layout[] | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const currentLayoutConfig = LAYOUT_TYPES.find(l => l.type === selectedLayoutType);

  const togglePhotoSelection = (photoIndex: number) => {
    setSelectedPhotoIndices(prev => {
      if (prev.includes(photoIndex)) {
        if (currentLayoutConfig && prev.length <= currentLayoutConfig.minPhotos) {
          toast.error(`${selectedLayoutType} requires at least ${currentLayoutConfig.minPhotos} photo${currentLayoutConfig.minPhotos > 1 ? 's' : ''}`);
          return prev;
        }
        return prev.filter(i => i !== photoIndex);
      } else {
        if (currentLayoutConfig && prev.length >= currentLayoutConfig.maxPhotos) {
          toast.error(`${selectedLayoutType} allows maximum ${currentLayoutConfig.maxPhotos} photos`);
          return prev;
        }
        return [...prev, photoIndex];
      }
    });
  };

  const movePhoto = (currentIndex: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= selectedPhotoIndices.length) return;
    
    const newOrder = [...selectedPhotoIndices];
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[newIndex];
    newOrder[newIndex] = temp;
    setSelectedPhotoIndices(newOrder);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    const newOrder = [...selectedPhotoIndices];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    setSelectedPhotoIndices(newOrder);
    setDraggedIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const applyChanges = () => {
    const isBeforeAfter = selectedLayoutType === 'Before/After';
    
    const updatedLayout: Layout = {
      ...layout,
      type: selectedLayoutType,
      description: currentLayoutConfig?.description || layout.description,
    };

    if (isBeforeAfter && selectedPhotoIndices.length >= 2) {
      updatedLayout.beforePhotoIndex = selectedPhotoIndices[0];
      updatedLayout.afterPhotoIndex = selectedPhotoIndices[1];
      delete updatedLayout.photoIndices;
    } else {
      updatedLayout.photoIndices = selectedPhotoIndices;
      delete updatedLayout.beforePhotoIndex;
      delete updatedLayout.afterPhotoIndex;
    }

    onUpdateLayout(updatedLayout);
    toast.success("Layout updated!");
  };

  const regenerateWithAI = async () => {
    setIsRegenerating(true);
    setAiSuggestions(null);

    try {
      const selectedPhotos = selectedPhotoIndices.map(idx => photos[idx]);
      
      const { data, error } = await supabase.functions.invoke('regenerate-layout', {
        body: {
          photos: selectedPhotos.map(p => p.url),
          currentLayoutType: selectedLayoutType,
          companyDetails: companyDetails || { name: '', description: '' },
          photoCount: selectedPhotoIndices.length,
        }
      });

      if (error) throw error;

      if (data?.layouts && data.layouts.length > 0) {
        const mappedLayouts = data.layouts.map((suggestion: any) => ({
          type: suggestion.type,
          description: suggestion.description,
          photoIndices: suggestion.photoIndices?.map((relIdx: number) => selectedPhotoIndices[relIdx]) || selectedPhotoIndices,
          beforePhotoIndex: suggestion.beforePhotoIndex !== undefined ? selectedPhotoIndices[suggestion.beforePhotoIndex] : undefined,
          afterPhotoIndex: suggestion.afterPhotoIndex !== undefined ? selectedPhotoIndices[suggestion.afterPhotoIndex] : undefined,
        }));
        setAiSuggestions(mappedLayouts);
        toast.success("AI generated new suggestions!");
      } else {
        toast.info("No new suggestions available for this selection");
      }
    } catch (error) {
      console.error('Error regenerating layout:', error);
      toast.error("Failed to regenerate. Try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const applySuggestion = (suggestion: Layout) => {
    setSelectedLayoutType(suggestion.type);
    if (suggestion.photoIndices) {
      setSelectedPhotoIndices(suggestion.photoIndices);
    } else if (suggestion.beforePhotoIndex !== undefined && suggestion.afterPhotoIndex !== undefined) {
      setSelectedPhotoIndices([suggestion.beforePhotoIndex, suggestion.afterPhotoIndex]);
    }
    
    onUpdateLayout(suggestion);
    setAiSuggestions(null);
    toast.success(`Applied ${suggestion.type} layout!`);
  };

  // Render the live preview based on layout type
  const renderLivePreview = () => {
    const selectedPhotos = selectedPhotoIndices.map(idx => photos[idx]).filter(Boolean);
    if (selectedPhotos.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Select photos to see preview</p>
        </div>
      );
    }

    const type = selectedLayoutType.toLowerCase();

    // Before/After
    if (type.includes('before') || type.includes('after')) {
      return (
        <div className="flex gap-1 h-full">
          <div className="flex-1 relative overflow-hidden rounded-lg">
            {selectedPhotos[0] && (
              <>
                <img src={selectedPhotos[0].url} alt="Before" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">BEFORE</span>
              </>
            )}
          </div>
          <div className="flex-1 relative overflow-hidden rounded-lg">
            {selectedPhotos[1] && (
              <>
                <img src={selectedPhotos[1].url} alt="After" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">AFTER</span>
              </>
            )}
          </div>
        </div>
      );
    }

    // Highlight / Story
    if (type.includes('highlight') || type.includes('story')) {
      return (
        <div className="relative h-full rounded-lg overflow-hidden">
          <img src={selectedPhotos[0]?.url} alt="Highlight" className="w-full h-full object-cover" />
        </div>
      );
    }

    // Triptych
    if (type.includes('triptych')) {
      return (
        <div className="flex gap-1 h-full">
          {selectedPhotos.slice(0, 3).map((photo, i) => (
            <div key={i} className="flex-1 relative overflow-hidden rounded-lg">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{i + 1}</span>
            </div>
          ))}
        </div>
      );
    }

    // Collage
    if (type.includes('collage')) {
      return (
        <div className="grid grid-cols-3 grid-rows-2 gap-1 h-full">
          {/* Hero photo */}
          <div className="col-span-2 row-span-2 relative overflow-hidden rounded-lg">
            <img src={selectedPhotos[0]?.url} alt="Main" className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">1 (Hero)</span>
          </div>
          {/* Right column */}
          <div className="relative overflow-hidden rounded-lg">
            {selectedPhotos[1] && <img src={selectedPhotos[1].url} alt="" className="w-full h-full object-cover" />}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">2</span>
          </div>
          <div className="relative overflow-hidden rounded-lg">
            {selectedPhotos[2] && <img src={selectedPhotos[2].url} alt="" className="w-full h-full object-cover" />}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">3</span>
          </div>
        </div>
      );
    }

    // Grid
    if (type.includes('grid')) {
      const cols = selectedPhotos.length <= 4 ? 2 : 3;
      return (
        <div className={`grid gap-1 h-full`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {selectedPhotos.slice(0, 9).map((photo, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg aspect-square">
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{i + 1}</span>
            </div>
          ))}
        </div>
      );
    }

    // Carousel / Slideshow
    return (
      <div className="h-full flex flex-col gap-2">
        {/* Main preview */}
        <div className="flex-1 relative overflow-hidden rounded-lg">
          <img src={selectedPhotos[0]?.url} alt="" className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {selectedPhotos.slice(0, 8).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/50'}`} />
            ))}
            {selectedPhotos.length > 8 && <span className="text-white text-xs">+{selectedPhotos.length - 8}</span>}
          </div>
        </div>
        {/* Thumbnail strip */}
        <div className="flex gap-1 h-12 overflow-x-auto">
          {selectedPhotos.slice(0, 10).map((photo, i) => (
            <div key={i} className={`relative h-full aspect-square flex-shrink-0 rounded overflow-hidden border-2 ${i === 0 ? 'border-primary' : 'border-transparent'}`}>
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {selectedPhotos.length > 10 && (
            <div className="h-full aspect-square flex-shrink-0 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
              +{selectedPhotos.length - 10}
            </div>
          )}
        </div>
      </div>
    );
  };

  const availablePhotos = photos.filter((_, idx) => !selectedPhotoIndices.includes(idx));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Live Preview */}
      <div className="order-2 lg:order-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Live Preview</h4>
          <Badge variant="outline">{selectedLayoutType}</Badge>
        </div>
        <div className="aspect-square bg-muted/30 rounded-xl p-2 border border-border">
          {renderLivePreview()}
        </div>
        
        {/* Selected photos strip with drag reorder */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium">Photo Order (drag to reorder)</p>
            <Badge variant={
              currentLayoutConfig && 
              selectedPhotoIndices.length >= currentLayoutConfig.minPhotos && 
              selectedPhotoIndices.length <= currentLayoutConfig.maxPhotos 
                ? 'default' 
                : 'destructive'
            } className="text-xs">
              {selectedPhotoIndices.length}/{currentLayoutConfig?.maxPhotos || '?'}
            </Badge>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 p-2 bg-muted/20 rounded-lg min-h-[80px]">
            {selectedPhotoIndices.map((photoIdx, orderIdx) => (
              <div
                key={`${photoIdx}-${orderIdx}`}
                draggable
                onDragStart={() => handleDragStart(orderIdx)}
                onDragOver={(e) => handleDragOver(e, orderIdx)}
                onDragEnd={handleDragEnd}
                className={`relative flex-shrink-0 group cursor-grab active:cursor-grabbing ${draggedIndex === orderIdx ? 'opacity-50' : ''}`}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-primary shadow-md relative">
                  <img src={photos[photoIdx]?.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-0 left-0 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center rounded-br">
                    {orderIdx + 1}
                  </div>
                  <button
                    onClick={() => togglePhotoSelection(photoIdx)}
                    className="absolute top-0 right-0 w-4 h-4 bg-destructive text-destructive-foreground rounded-bl flex items-center justify-center hover:bg-destructive/80"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-0.5">
                    <GripVertical className="h-3 w-3 text-white/70" />
                  </div>
                </div>
                {/* Arrow controls on hover */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => movePhoto(orderIdx, 'left')}
                    disabled={orderIdx === 0}
                    className="w-4 h-4 bg-background border border-border rounded flex items-center justify-center hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronLeft className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => movePhoto(orderIdx, 'right')}
                    disabled={orderIdx === selectedPhotoIndices.length - 1}
                    className="w-4 h-4 bg-background border border-border rounded flex items-center justify-center hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
            {selectedPhotoIndices.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Click photos to add
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Controls */}
      <div className="order-1 lg:order-2 space-y-4">
        {/* Layout Type Selector */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Layout Type</h4>
          <div className="grid grid-cols-4 gap-1.5">
            {LAYOUT_TYPES.map((layoutConfig) => {
              const Icon = layoutConfig.icon;
              const isSelected = selectedLayoutType === layoutConfig.type;
              const photoCountValid = selectedPhotoIndices.length >= layoutConfig.minPhotos && 
                                     selectedPhotoIndices.length <= layoutConfig.maxPhotos;
              
              return (
                <button
                  key={layoutConfig.type}
                  onClick={() => setSelectedLayoutType(layoutConfig.type)}
                  className={`p-2 rounded-lg border transition-all text-left ${
                    isSelected 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/40'
                  } ${!photoCountValid && !isSelected ? 'opacity-50' : ''}`}
                >
                  <Icon className={`h-4 w-4 mb-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-[10px] font-medium truncate">{layoutConfig.type}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {layoutConfig.minPhotos === layoutConfig.maxPhotos 
                      ? `${layoutConfig.minPhotos}`
                      : `${layoutConfig.minPhotos}-${layoutConfig.maxPhotos}`
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Available Photos Grid */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Add Photos</h4>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-2 bg-muted/20 rounded-lg">
            {availablePhotos.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground text-center py-4">All photos selected</p>
            ) : (
              photos.map((photo, idx) => {
                const isSelected = selectedPhotoIndices.includes(idx);
                if (isSelected) return null;
                
                return (
                  <motion.button
                    key={idx}
                    onClick={() => togglePhotoSelection(idx)}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/60 transition-all group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                      <Plus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg" />
                    </div>
                    <span className="absolute bottom-0 left-0 right-0 text-[8px] bg-black/60 text-white text-center">
                      #{idx + 1}
                    </span>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* AI Suggestions */}
        <AnimatePresence>
          {aiSuggestions && aiSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20"
            >
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                AI Suggestions
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => applySuggestion(suggestion)}
                    className="p-2 bg-background rounded border border-border hover:border-primary/40 transition-all text-left"
                  >
                    <div className="font-medium text-xs">{suggestion.type}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1">
                      {suggestion.description}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateWithAI}
            disabled={isRegenerating || selectedPhotoIndices.length === 0}
            className="flex-1"
          >
            {isRegenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRegenerating ? 'Generating...' : 'AI Suggest'}
          </Button>
          
          <Button
            size="sm"
            onClick={applyChanges}
            disabled={
              !currentLayoutConfig ||
              selectedPhotoIndices.length < currentLayoutConfig.minPhotos ||
              selectedPhotoIndices.length > currentLayoutConfig.maxPhotos
            }
            className="flex-1 gradient-primary"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
};
