import { motion } from "framer-motion";
import { 
  Columns2, 
  Grid2X2, 
  Image, 
  Play, 
  Layers, 
  LayoutGrid, 
  Rows3, 
  Square,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Layout {
  type: string;
  description?: string;
  preview?: string;
  beforePhotoIndex?: number;
  afterPhotoIndex?: number;
  photoIndices?: number[];
}

interface LayoutCardProps {
  layout: Layout;
  photos: Array<{ url: string; timestamp?: string }>;
  index: number;
  onClick: () => void;
}

const getLayoutIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('before') || t.includes('after')) return Columns2;
  if (t.includes('carousel')) return Layers;
  if (t.includes('grid')) return Grid2X2;
  if (t.includes('slideshow') || t.includes('video')) return Play;
  if (t.includes('highlight') || t.includes('single')) return Image;
  if (t.includes('collage')) return LayoutGrid;
  if (t.includes('story') || t.includes('vertical')) return Rows3;
  if (t.includes('triptych')) return Rows3;
  return Square;
};

const getLayoutBadge = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('slideshow') || t.includes('video')) return { label: 'Video Ready', variant: 'default' as const };
  if (t.includes('before') || t.includes('after')) return { label: 'Transformation', variant: 'secondary' as const };
  if (t.includes('carousel')) return { label: 'Multi-Post', variant: 'outline' as const };
  return null;
};

export const LayoutCard = ({ layout, photos, index, onClick }: LayoutCardProps) => {
  const layoutType = layout.type.toLowerCase();
  const isBeforeAfter = layoutType.includes('before') || layoutType.includes('after');
  const isCarousel = layoutType.includes('carousel');
  const isGrid = layoutType.includes('grid');
  const isHighlight = layoutType.includes('highlight') || layoutType.includes('single');
  const isSlideshow = layoutType.includes('slideshow') || layoutType.includes('video');
  const isCollage = layoutType.includes('collage');
  const isStory = layoutType.includes('story') || layoutType.includes('vertical');
  const isTriptych = layoutType.includes('triptych');
  
  const Icon = getLayoutIcon(layout.type);
  const badge = getLayoutBadge(layout.type);
  const photoIndices = layout.photoIndices || photos.map((_, i) => i);
  const photoCount = isBeforeAfter ? 2 : (layout.photoIndices?.length || photos.length);

  return (
    <motion.div 
      className="group relative bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
    >
      {/* Preview Area */}
      <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
        {/* Before/After Preview */}
        {isBeforeAfter && photos.length >= 2 && (
          <div className="absolute inset-0 flex">
            <div className="w-1/2 relative overflow-hidden">
              <img 
                src={photos[layout.beforePhotoIndex ?? 0]?.url} 
                alt="Before"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
                Before
              </div>
            </div>
            <div className="w-px bg-primary/80" />
            <div className="w-1/2 relative overflow-hidden">
              <img 
                src={photos[layout.afterPhotoIndex ?? photos.length - 1]?.url} 
                alt="After"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
                After
              </div>
            </div>
          </div>
        )}

        {/* Slideshow Preview */}
        {isSlideshow && !isBeforeAfter && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              <img 
                src={photos[photoIndices[0]]?.url}
                alt="Slideshow"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-4 w-4 text-black fill-black ml-0.5" />
                </div>
                <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-white rounded-full" />
                </div>
              </div>
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 rounded-full text-[10px] text-white font-medium">
                {photoCount} slides
              </div>
            </div>
          </div>
        )}

        {/* Grid Preview */}
        {isGrid && !isBeforeAfter && !isSlideshow && (
          <div className="absolute inset-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
            {photoIndices.slice(0, 4).map((idx, i) => (
              <div key={i} className="relative overflow-hidden">
                <img 
                  src={photos[idx]?.url}
                  alt={`Grid ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Carousel Preview */}
        {isCarousel && !isBeforeAfter && !isSlideshow && !isGrid && (
          <div className="absolute inset-0 flex items-center px-3">
            <div className="flex gap-2 w-full">
              {photoIndices.slice(0, 3).map((idx, i) => (
                <div 
                  key={i} 
                  className={`relative rounded-lg overflow-hidden shadow-md ${
                    i === 0 ? 'w-2/3 h-32' : 'w-1/6 h-24 opacity-60'
                  }`}
                  style={{ 
                    transform: i > 0 ? `translateX(${(i - 1) * -20}px)` : undefined,
                    zIndex: 3 - i 
                  }}
                >
                  <img 
                    src={photos[idx]?.url}
                    alt={`Carousel ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photoIndices.slice(0, Math.min(5, photoIndices.length)).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-white/50'}`} />
              ))}
              {photoIndices.length > 5 && <span className="text-[10px] text-white/70 ml-1">+{photoIndices.length - 5}</span>}
            </div>
          </div>
        )}

        {/* Highlight/Single Preview */}
        {isHighlight && !isBeforeAfter && !isCarousel && !isSlideshow && !isGrid && photos.length > 0 && (
          <img 
            src={photos[layout.photoIndices?.[0] ?? 0]?.url}
            alt="Highlight"
            className="w-full h-full object-cover"
          />
        )}

        {/* Collage Preview */}
        {isCollage && (
          <div className="absolute inset-2 grid grid-cols-3 grid-rows-2 gap-1 rounded-lg overflow-hidden">
            <div className="col-span-2 row-span-2 relative overflow-hidden">
              <img src={photos[photoIndices[0]]?.url} alt="Main" className="w-full h-full object-cover" />
            </div>
            {photoIndices.slice(1, 4).map((idx, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={photos[idx]?.url} alt={`Collage ${i + 2}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Story/Vertical Preview */}
        {isStory && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-20 h-36 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
              <img src={photos[photoIndices[0]]?.url} alt="Story" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* Triptych Preview */}
        {isTriptych && (
          <div className="absolute inset-2 flex gap-1 rounded-lg overflow-hidden">
            {photoIndices.slice(0, 3).map((idx, i) => (
              <div key={i} className="flex-1 relative overflow-hidden">
                <img src={photos[idx]?.url} alt={`Panel ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Fallback */}
        {!isBeforeAfter && !isCarousel && !isGrid && !isHighlight && !isSlideshow && !isCollage && !isStory && !isTriptych && (
          <div className="absolute inset-2 flex gap-1 rounded-lg overflow-hidden">
            {photoIndices.slice(0, 3).map((idx, i) => (
              <div key={i} className="flex-1 relative overflow-hidden">
                <img src={photos[idx]?.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
          <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 shadow-lg">
            Open Preview
          </span>
        </div>
      </div>

      {/* Info Area */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold capitalize leading-tight">{layout.type}</h3>
              <p className="text-xs text-muted-foreground">{photoCount} photo{photoCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {badge && (
            <Badge variant={badge.variant} className="text-[10px] shrink-0">
              {badge.label}
            </Badge>
          )}
        </div>
        
        {layout.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {layout.description}
          </p>
        )}

        <div className="flex items-center gap-1 pt-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] text-muted-foreground">AI Recommended</span>
        </div>
      </div>
    </motion.div>
  );
};
