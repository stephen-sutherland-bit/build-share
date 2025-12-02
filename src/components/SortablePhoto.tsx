import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, GripVertical } from "lucide-react";

interface SortablePhotoProps {
  id: string;
  photo: { url: string; timestamp?: string };
  index: number;
  originalIndex: number;
  onDownload: (url: string, index: number) => void;
  onClick: () => void;
}

export const SortablePhoto = ({ id, photo, index, originalIndex, onDownload, onClick }: SortablePhotoProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const wasReordered = index !== originalIndex;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`relative group overflow-hidden rounded-lg border transition-all ${
        isDragging 
          ? "shadow-lg border-primary ring-2 ring-primary/50 scale-105" 
          : "border-border hover:shadow-medium"
      } ${wasReordered ? "ring-2 ring-amber-500/50" : ""}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded p-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Order Badge */}
      <span className={`absolute top-2 left-2 z-10 text-xs font-bold px-2 py-1 rounded ${
        wasReordered 
          ? "bg-amber-500 text-white" 
          : "bg-primary text-primary-foreground"
      }`}>
        #{index + 1}
        {wasReordered && (
          <span className="ml-1 text-[10px] opacity-80">
            (was #{originalIndex + 1})
          </span>
        )}
      </span>

      {/* Photo */}
      <img
        src={photo.url}
        alt={`Construction photo ${index + 1}`}
        className="w-full aspect-square object-cover cursor-pointer"
        onClick={onClick}
        draggable={false}
      />

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-end p-3 pointer-events-none">
        <Button
          variant="secondary"
          size="sm"
          className="w-full pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(photo.url, index);
          }}
        >
          <Download className="mr-2 h-3 w-3" />
          Download
        </Button>
      </div>
    </motion.div>
  );
};
