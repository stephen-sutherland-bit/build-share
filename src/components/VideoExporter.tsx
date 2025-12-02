import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Video, Download, Play, Pause, Music, Clock, Sparkles, Loader2, X, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

interface VideoExporterProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Array<{ url: string }>;
}

type TransitionType = "fade" | "slide" | "zoom" | "none";
type MusicOption = "none" | "upbeat" | "corporate" | "emotional" | "custom";

// Royalty-free audio URLs (placeholder - in production these would be actual audio files)
const MUSIC_OPTIONS: Record<MusicOption, { label: string; description: string }> = {
  none: { label: "No Music", description: "Silent video" },
  upbeat: { label: "Upbeat Energy", description: "Energetic construction vibe" },
  corporate: { label: "Corporate Professional", description: "Clean, business-friendly" },
  emotional: { label: "Inspiring Journey", description: "Emotional transformation story" },
  custom: { label: "Custom Audio", description: "Upload your own" },
};

export const VideoExporter = ({ isOpen, onClose, photos }: VideoExporterProps) => {
  const [duration, setDuration] = useState(2); // seconds per photo
  const [transition, setTransition] = useState<TransitionType>("fade");
  const [music, setMusic] = useState<MusicOption>("none");
  const [customAudio, setCustomAudio] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Load FFmpeg on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadFFmpeg = async () => {
      if (ffmpegRef.current && ffmpegLoaded) return;
      
      setLoadingStage("Loading video engine...");
      
      try {
        const ffmpeg = new FFmpeg();
        
        ffmpeg.on("progress", ({ progress: p }) => {
          if (isMounted) setProgress(Math.round(p * 100));
        });

        ffmpeg.on("log", ({ message }) => {
          console.log("[FFmpeg]", message);
        });

        // Use jsdelivr CDN - more reliable than unpkg
        const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
        
        // Load with timeout to prevent infinite hanging
        const loadPromise = ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Loading timed out")), 60000)
        );
        
        await Promise.race([loadPromise, timeoutPromise]);
        
        if (isMounted) {
          ffmpegRef.current = ffmpeg;
          setFfmpegLoaded(true);
          setLoadingStage("");
          console.log("[FFmpeg] Successfully loaded");
        }
      } catch (error) {
        console.error("FFmpeg load error:", error);
        if (isMounted) {
          toast.error("Failed to load video engine. Please refresh and try again.");
          setLoadingStage("Failed to load");
        }
      }
    };

    if (isOpen && !ffmpegLoaded) {
      loadFFmpeg();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, ffmpegLoaded]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomAudio(file);
      setMusic("custom");
      toast.success(`Audio loaded: ${file.name}`);
    }
  };

  const generateVideo = async () => {
    if (!ffmpegRef.current || !ffmpegLoaded) {
      toast.error("Video engine not ready");
      return;
    }

    setIsLoading(true);
    setProgress(0);
    const ffmpeg = ffmpegRef.current;

    try {
      // Step 1: Download and write images to FFmpeg filesystem
      setLoadingStage(`Processing ${photos.length} photos...`);
      
      for (let i = 0; i < photos.length; i++) {
        setLoadingStage(`Loading photo ${i + 1}/${photos.length}...`);
        setProgress(Math.round((i / photos.length) * 30));
        
        const response = await fetch(photos[i].url);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        await ffmpeg.writeFile(`img${String(i).padStart(4, '0')}.jpg`, new Uint8Array(arrayBuffer));
      }

      // Step 2: Create filter complex for transitions
      setLoadingStage("Creating transitions...");
      setProgress(40);

      const fps = 30;
      const frameDuration = duration * fps;
      const transitionFrames = Math.floor(fps * 0.5); // 0.5 second transitions

      let filterComplex = "";
      let inputs = "";
      
      // Build the filter based on transition type
      if (transition === "none") {
        // Simple concatenation without transitions
        for (let i = 0; i < photos.length; i++) {
          inputs += `-loop 1 -t ${duration} -i img${String(i).padStart(4, '0')}.jpg `;
        }
        filterComplex = photos.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`).join(";");
        filterComplex += ";" + photos.map((_, i) => `[v${i}]`).join("") + `concat=n=${photos.length}:v=1:a=0[outv]`;
      } else {
        // With transitions - use xfade filter
        for (let i = 0; i < photos.length; i++) {
          inputs += `-loop 1 -t ${duration + 0.5} -i img${String(i).padStart(4, '0')}.jpg `;
        }
        
        // Scale all inputs
        filterComplex = photos.map((_, i) => 
          `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${i}]`
        ).join(";");

        // Apply xfade transitions
        const transitionName = transition === "fade" ? "fade" : transition === "slide" ? "slideleft" : "zoompan";
        
        if (photos.length > 1) {
          let lastOutput = "[v0]";
          for (let i = 1; i < photos.length; i++) {
            const offset = duration * i - 0.5 * (i);
            const outputLabel = i === photos.length - 1 ? "[outv]" : `[xf${i}]`;
            filterComplex += `;${lastOutput}[v${i}]xfade=transition=${transitionName}:duration=0.5:offset=${offset.toFixed(2)}${outputLabel}`;
            lastOutput = `[xf${i}]`;
          }
        } else {
          filterComplex += ";[v0]copy[outv]";
        }
      }

      // Step 3: Generate video
      setLoadingStage("Encoding video...");
      setProgress(50);

      const totalDuration = photos.length * duration;
      
      // Parse inputs properly
      const inputArgs = inputs.trim().split(" ").filter(Boolean);
      
      await ffmpeg.exec([
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", "[outv]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "23",
        "-t", String(totalDuration),
        "-y",
        "output.mp4"
      ]);

      // Step 4: Read the output
      setLoadingStage("Finalizing...");
      setProgress(90);

      const data = await ffmpeg.readFile("output.mp4");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const videoBlob = new Blob([data as any], { type: "video/mp4" });
      
      // Cleanup old preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      const url = URL.createObjectURL(videoBlob);
      setPreviewUrl(url);
      setProgress(100);
      setLoadingStage("");
      
      toast.success("Video created! Preview it below.");
    } catch (error) {
      console.error("Video generation error:", error);
      toast.error("Failed to generate video. Try with fewer photos.");
      setLoadingStage("");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!previewUrl) return;
    
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `construction-slideshow-${new Date().toISOString().split("T")[0]}.mp4`;
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
  const estimatedSize = Math.ceil(photos.length * 0.5); // Rough estimate MB

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Video className="h-6 w-6 text-primary" />
            Create Video Slideshow
          </DialogTitle>
          <DialogDescription>
            Generate a professional MP4 video from your {photos.length} photos
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
                  muted={isMuted}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={togglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
              <Select value={transition} onValueChange={(v) => setTransition(v as TransitionType)}>
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

          {/* Music Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Background Music
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(Object.entries(MUSIC_OPTIONS) as [MusicOption, typeof MUSIC_OPTIONS[MusicOption]][]).map(([key, { label, description }]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "custom") {
                      audioInputRef.current?.click();
                    } else {
                      setMusic(key);
                      setCustomAudio(null);
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    music === key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </button>
              ))}
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioUpload}
            />
            {customAudio && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Music className="h-3 w-3" />
                {customAudio.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Note: Music will be added in a future update. Video exports silently for now.
            </p>
          </div>

          {/* Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <span>Estimated file size: ~{estimatedSize}MB</span>
            <span>Resolution: 1920×1080 (HD)</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {!ffmpegLoaded && !isLoading ? (
              <Button 
                disabled={loadingStage !== "Failed to load"} 
                onClick={loadingStage === "Failed to load" ? () => window.location.reload() : undefined}
                className="flex-1"
              >
                {loadingStage === "Failed to load" ? (
                  <>Reload Page to Retry</>
                ) : (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading Video Engine...
                  </>
                )}
              </Button>
            ) : previewUrl ? (
              <>
                <Button variant="outline" onClick={() => setPreviewUrl(null)} className="flex-1">
                  <X className="mr-2 h-4 w-4" />
                  Create New
                </Button>
                <Button onClick={downloadVideo} className="flex-1 gradient-primary">
                  <Download className="mr-2 h-4 w-4" />
                  Download MP4
                </Button>
              </>
            ) : (
              <Button
                onClick={generateVideo}
                disabled={isLoading || !ffmpegLoaded}
                className="w-full gradient-primary"
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
