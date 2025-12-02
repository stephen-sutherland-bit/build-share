import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, ImageIcon, CheckCircle2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

const MAX_PHOTOS = 80;

interface PhotoUploaderProps {
  onUpload: (files: File[]) => void;
  onProcess: () => void;
  isProcessing: boolean;
  photoCount: number;
  processingProgress?: { currentBatch: number; totalBatches: number } | null;
}

export const PhotoUploader = ({ onUpload, onProcess, isProcessing, photoCount, processingProgress }: PhotoUploaderProps) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== acceptedFiles.length) {
      toast.error("Only image files are accepted");
    }
    if (imageFiles.length > MAX_PHOTOS) {
      toast.warning(`Maximum ${MAX_PHOTOS} photos allowed. Only the first ${MAX_PHOTOS} will be processed.`);
      onUpload(imageFiles.slice(0, MAX_PHOTOS));
    } else if (imageFiles.length > 0) {
      onUpload(imageFiles);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: true
  });

  return (
    <Card className="shadow-soft hover:shadow-medium transition-smooth border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center ring-1 ring-accent/20">
            <ImageIcon className="h-6 w-6 text-accent" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-display tracking-tight">Upload Job Photos</CardTitle>
            <CardDescription className="text-sm">
              Drop photos from your construction project (max {MAX_PHOTOS})
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer overflow-hidden
            transition-all duration-200 ease-out
            ${isDragActive 
              ? 'border-primary bg-primary/5 scale-[1.01]' 
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className={`
              h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isDragActive 
                ? 'bg-primary/20 scale-110' 
                : 'bg-primary/10'
              }
            `}>
              <Upload className={`h-7 w-7 text-primary transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold tracking-tight">
                {isDragActive ? "Drop photos here" : "Drag & drop photos"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
          </div>
        </div>

        {photoCount > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm font-medium tracking-tight">
                  {photoCount} photo{photoCount !== 1 ? 's' : ''} ready
                </span>
              </div>
              <Button
                onClick={onProcess}
                disabled={isProcessing}
                className="gradient-accent shadow-soft hover:shadow-medium hover:opacity-95 transition-smooth font-semibold"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </div>
            
            {isProcessing && processingProgress && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-primary">Processing photos...</span>
                  <span className="text-muted-foreground">
                    {processingProgress.currentBatch}/{processingProgress.totalBatches}
                  </span>
                </div>
                <Progress 
                  value={(processingProgress.currentBatch / processingProgress.totalBatches) * 100} 
                  className="h-2"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
