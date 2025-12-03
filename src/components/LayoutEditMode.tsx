import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Sparkles, 
  Loader2, 
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Grid2X2,
  Image as ImageIcon,
  Play,
  Layers,
  LayoutGrid,
  Rows3,
  X
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

  const currentLayoutConfig = LAYOUT_TYPES.find(l => l.type === selectedLayoutType);

  const togglePhotoSelection = (photoIndex: number) => {
    setSelectedPhotoIndices(prev => {
      if (prev.includes(photoIndex)) {
        // Don't allow removing if at minimum
        if (currentLayoutConfig && prev.length <= currentLayoutConfig.minPhotos) {
          toast.error(`${selectedLayoutType} requires at least ${currentLayoutConfig.minPhotos} photo${currentLayoutConfig.minPhotos > 1 ? 's' : ''}`);
          return prev;
        }
        return prev.filter(i => i !== photoIndex);
      } else {
        // Don't allow adding if at maximum
        if (currentLayoutConfig && prev.length >= currentLayoutConfig.maxPhotos) {
          toast.error(`${selectedLayoutType} allows maximum ${currentLayoutConfig.maxPhotos} photos`);
          return prev;
        }
        return [...prev, photoIndex];
      }
    });
  };

  const handleReorder = (newOrder: number[]) => {
    setSelectedPhotoIndices(newOrder);
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
        // Map AI suggestions back to actual photo indices
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

  return (
    <div className="space-y-6">
      {/* Layout Type Selector */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Layout Type</h4>
        <div className="grid grid-cols-4 gap-2">
          {LAYOUT_TYPES.map((layoutConfig) => {
            const Icon = layoutConfig.icon;
            const isSelected = selectedLayoutType === layoutConfig.type;
            const photoCountValid = selectedPhotoIndices.length >= layoutConfig.minPhotos && 
                                   selectedPhotoIndices.length <= layoutConfig.maxPhotos;
            
            return (
              <button
                key={layoutConfig.type}
                onClick={() => setSelectedLayoutType(layoutConfig.type)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/40'
                } ${!photoCountValid && !isSelected ? 'opacity-50' : ''}`}
              >
                <Icon className={`h-5 w-5 mb-1 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-xs font-medium">{layoutConfig.type}</div>
                <div className="text-[10px] text-muted-foreground">
                  {layoutConfig.minPhotos === layoutConfig.maxPhotos 
                    ? `${layoutConfig.minPhotos} photo${layoutConfig.minPhotos > 1 ? 's' : ''}`
                    : `${layoutConfig.minPhotos}-${layoutConfig.maxPhotos} photos`
                  }
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo Selection Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold">Select & Reorder Photos</h4>
            <p className="text-xs text-muted-foreground">
              {selectedPhotoIndices.length} selected • Drag to reorder
            </p>
          </div>
          <Badge variant={
            currentLayoutConfig && 
            selectedPhotoIndices.length >= currentLayoutConfig.minPhotos && 
            selectedPhotoIndices.length <= currentLayoutConfig.maxPhotos 
              ? 'default' 
              : 'destructive'
          }>
            {currentLayoutConfig?.minPhotos === currentLayoutConfig?.maxPhotos 
              ? `Need ${currentLayoutConfig?.minPhotos}`
              : `${currentLayoutConfig?.minPhotos}-${currentLayoutConfig?.maxPhotos} needed`
            }
          </Badge>
        </div>

        {/* Selected Photos - Reorderable with arrows */}
        {selectedPhotoIndices.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Selected photos (use arrows to reorder):</p>
            <div className="flex gap-1 flex-wrap p-3 bg-primary/5 rounded-xl min-h-[100px]">
              {selectedPhotoIndices.map((photoIdx, orderIdx) => (
                <motion.div
                  key={`${photoIdx}-${orderIdx}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-primary shadow-md">
                    <img 
                      src={photos[photoIdx]?.url} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                    {/* Position number */}
                    <div className="absolute top-0 left-0 w-6 h-6 bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center rounded-br-lg">
                      {orderIdx + 1}
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => togglePhotoSelection(photoIdx)}
                      className="absolute top-0 right-0 w-5 h-5 bg-destructive text-destructive-foreground rounded-bl-lg flex items-center justify-center hover:bg-destructive/80 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Reorder controls */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => movePhoto(orderIdx, 'left')}
                      disabled={orderIdx === 0}
                      className="w-5 h-5 bg-background border border-border rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => movePhoto(orderIdx, 'right')}
                      disabled={orderIdx === selectedPhotoIndices.length - 1}
                      className="w-5 h-5 bg-background border border-border rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* All Photos Grid */}
        <p className="text-xs text-muted-foreground mb-2">All photos (click to select/deselect):</p>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded-xl">
          {photos.map((photo, idx) => {
            const isSelected = selectedPhotoIndices.includes(idx);
            const orderInSelection = selectedPhotoIndices.indexOf(idx);
            
            return (
              <motion.button
                key={idx}
                onClick={() => togglePhotoSelection(idx)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/30' 
                    : 'border-transparent hover:border-primary/40'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {orderInSelection + 1}
                    </div>
                  </div>
                )}
                <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-black/60 text-white text-center">
                  #{idx + 1}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* AI Suggestions */}
      <AnimatePresence>
        {aiSuggestions && aiSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-primary/5 rounded-xl border border-primary/20"
          >
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Suggestions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => applySuggestion(suggestion)}
                  className="p-3 bg-background rounded-lg border border-border hover:border-primary/40 transition-all text-left"
                >
                  <div className="font-medium text-sm">{suggestion.type}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {suggestion.description}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={regenerateWithAI}
          disabled={isRegenerating || selectedPhotoIndices.length === 0}
          className="flex-1"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerate with AI
            </>
          )}
        </Button>
        
        <Button
          onClick={applyChanges}
          disabled={
            !currentLayoutConfig ||
            selectedPhotoIndices.length < currentLayoutConfig.minPhotos ||
            selectedPhotoIndices.length > currentLayoutConfig.maxPhotos
          }
          className="flex-1 gradient-primary"
        >
          <Check className="mr-2 h-4 w-4" />
          Apply Changes
        </Button>
      </div>
    </div>
  );
};
