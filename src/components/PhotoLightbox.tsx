import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoLightboxProps {
  photos: Array<{ url: string; timestamp?: string }>;
  initialIndex: number;
  onClose: () => void;
  onDownload: (url: string, index: number) => void;
}

export const PhotoLightbox = ({ photos, initialIndex, onClose, onDownload }: PhotoLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setCurrentIndex(prev => Math.max(0, prev - 1));
      if (e.key === "ArrowRight") setCurrentIndex(prev => Math.min(photos.length - 1, prev + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, photos.length]);

  const goToPrevious = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const goToNext = () => setCurrentIndex(prev => Math.min(photos.length - 1, prev + 1));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Download Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-16 text-white hover:bg-white/20 z-50"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(photos[currentIndex].url, currentIndex);
        }}
      >
        <Download className="h-6 w-6" />
      </Button>

      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/80 text-sm font-medium z-50">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {currentIndex < photos.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main Image */}
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={photos[currentIndex].url}
          alt={`Photo ${currentIndex + 1}`}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        />
      </AnimatePresence>

      {/* Thumbnail Strip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4 py-2 bg-black/50 rounded-xl backdrop-blur-sm max-w-[90vw] overflow-x-auto">
        {photos.map((photo, idx) => (
          <motion.button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
              idx === currentIndex ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
            }`}
            whileHover={{ scale: idx === currentIndex ? 1.1 : 1.05 }}
          >
            <img src={photo.url} alt="" className="w-full h-full object-cover" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};