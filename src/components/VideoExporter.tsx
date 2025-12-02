import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Video, Download, Play, Pause, Clock, Sparkles, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface VideoExporterProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Array<{ url: string }>;
}

type TransitionType = "fade" | "slide" | "zoom" | "none";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FPS = 30;

export const VideoExporter = ({ isOpen, onClose, photos }: VideoExporterProps) => {
  const [duration, setDuration] = useState(2);
  const [transition, setTransition] = useState<TransitionType>("fade");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const drawImageCover = (
    ctx: CanvasRenderingContext2D, 
    img: HTMLImageElement, 
    alpha: number = 1, 
    scale: number = 1, 
    offsetX: number = 0
  ) => {
    ctx.globalAlpha = alpha;
    
    const imgRatio = img.width / img.height;
    const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
    
    let drawWidth, drawHeight, sx, sy;
    
    if (imgRatio > canvasRatio) {
      drawHeight = img.height;
      drawWidth = img.height * canvasRatio;
      sx = (img.width - drawWidth) / 2;
      sy = 0;
    } else {
      drawWidth = img.width;
      drawHeight = img.width / canvasRatio;
      sx = 0;
      sy = (img.height - drawHeight) / 2;
    }
    
    const scaledWidth = CANVAS_WIDTH * scale;
    const scaledHeight = CANVAS_HEIGHT * scale;
    const x = (CANVAS_WIDTH - scaledWidth) / 2 + offsetX;
    const y = (CANVAS_HEIGHT - scaledHeight) / 2;
    
    ctx.drawImage(img, sx, sy, drawWidth, drawHeight, x, y, scaledWidth, scaledHeight);
    ctx.globalAlpha = 1;
  };

  const generateVideo = useCallback(async () => {
    if (photos.length === 0) {
      toast.error("No photos to create video");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setLoadingStage("Loading photos...");

    try {
      // Load all images first
      const images: HTMLImageElement[] = [];
      for (let i = 0; i < photos.length; i++) {
        try {
          const img = await loadImage(photos[i].url);
          images.push(img);
        } catch (err) {
          console.warn(`Failed to load image ${i}, skipping...`, err);
        }
        setProgress(Math.round(((i + 1) / photos.length) * 30));
      }

      if (images.length === 0) {
        throw new Error("No images could be loaded");
      }

      setLoadingStage("Generating video...");

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d")!;

      // Setup MediaRecorder
      const stream = canvas.captureStream(FPS);
      
      // Try VP9 first, fallback to VP8
      let mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
      });

      mediaRecorder.start();

      // Animation parameters
      const framesPerPhoto = duration * FPS;
      const transitionFrames = transition === "none" ? 0 : Math.min(15, framesPerPhoto / 4);
      const totalFrames = framesPerPhoto * images.length;

      // Render frames
      for (let frame = 0; frame < totalFrames; frame++) {
        const photoIndex = Math.floor(frame / framesPerPhoto);
        const frameInPhoto = frame % framesPerPhoto;
        const currentImg = images[photoIndex];
        const nextImg = images[Math.min(photoIndex + 1, images.length - 1)];
        
        // Clear canvas
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Check if we're in transition phase
        const isInTransition = frameInPhoto >= framesPerPhoto - transitionFrames && photoIndex < images.length - 1;
        const transitionProgress = isInTransition 
          ? (frameInPhoto - (framesPerPhoto - transitionFrames)) / transitionFrames 
          : 0;

        switch (transition) {
          case "fade":
            drawImageCover(ctx, currentImg, isInTransition ? 1 - transitionProgress : 1);
            if (isInTransition) {
              drawImageCover(ctx, nextImg, transitionProgress);
            }
            break;
            
          case "slide":
            if (isInTransition) {
              const offset = -CANVAS_WIDTH * transitionProgress;
              drawImageCover(ctx, currentImg, 1, 1, offset);
              drawImageCover(ctx, nextImg, 1, 1, CANVAS_WIDTH + offset);
            } else {
              drawImageCover(ctx, currentImg);
            }
            break;
            
          case "zoom":
            if (isInTransition) {
              const zoomOut = 1 - transitionProgress * 0.1;
              const zoomIn = 0.9 + transitionProgress * 0.1;
              drawImageCover(ctx, currentImg, 1 - transitionProgress, zoomOut);
              drawImageCover(ctx, nextImg, transitionProgress, zoomIn);
            } else {
              const subtleZoom = 1 + (frameInPhoto / framesPerPhoto) * 0.05;
              drawImageCover(ctx, currentImg, 1, subtleZoom);
            }
            break;
            
          case "none":
          default:
            drawImageCover(ctx, currentImg);
            break;
        }

        // Update progress (30-90%)
        setProgress(30 + Math.round((frame / totalFrames) * 60));

        // Wait for next frame timing
        await new Promise(resolve => setTimeout(resolve, 1000 / FPS));
      }

      setLoadingStage("Finalizing...");
      mediaRecorder.stop();
      
      const blob = await recordingPromise;
      setProgress(100);

      // Create preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setLoadingStage("");
      toast.success("Video generated successfully!");

    } catch (error) {
      console.error("Video generation error:", error);
      toast.error("Failed to generate video");
      setLoadingStage("");
    } finally {
      setIsLoading(false);
    }
  }, [photos, duration, transition, previewUrl]);

  const downloadVideo = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `construction-slideshow-${new Date().toISOString().split("T")[0]}.webm`;
    a.click();
    toast.success("Video downloaded!");
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const estimatedTime = Math.ceil(photos.length * duration);
  const estimatedSize = Math.round((photos.length * duration * 0.8) * 10) / 10;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Video className="h-6 w-6 text-primary" />
            Create Video Slideshow
          </DialogTitle>
          <DialogDescription>
            Generate a video from your {photos.length} photos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview or Generation Area */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-border">
            {previewUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  onEnded={() => setIsPlaying(false)}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={togglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            ) : isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="w-full max-w-xs space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">{loadingStage}</p>
                  <p className="text-xs text-muted-foreground text-center">{progress}%</p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-1">
                  {photos.slice(0, 5).map((photo, i) => (
                    <motion.img
                      key={i}
                      src={photo.url}
                      alt=""
                      className="h-16 w-16 object-cover rounded"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    />
                  ))}
                  {photos.length > 5 && (
                    <div className="h-16 w-16 bg-muted-foreground/20 rounded flex items-center justify-center">
                      <span className="text-sm font-medium">+{photos.length - 5}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Configure settings below and generate</p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Duration per Photo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Duration per Photo
                </Label>
                <span className="text-sm font-medium">{duration}s</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={1}
                max={5}
                step={0.5}
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Total video length: ~{estimatedTime}s
              </p>
            </div>

            {/* Transition Style */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Transition Style
              </Label>
              <Select 
                value={transition} 
                onValueChange={(v) => setTransition(v as TransitionType)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Fade (Smooth)</SelectItem>
                  <SelectItem value="slide">Slide (Dynamic)</SelectItem>
                  <SelectItem value="zoom">Zoom (Cinematic)</SelectItem>
                  <SelectItem value="none">None (Quick cuts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <span>Estimated size: ~{estimatedSize}MB</span>
            <span>Resolution: 1920×1080 (HD)</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {previewUrl ? (
              <>
                <Button variant="outline" onClick={() => setPreviewUrl(null)} className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Create New
                </Button>
                <Button onClick={downloadVideo} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download Video
                </Button>
              </>
            ) : (
              <Button 
                onClick={generateVideo} 
                disabled={isLoading || photos.length === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Generate Video
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
