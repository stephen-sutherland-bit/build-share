import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, ImageIcon } from "lucide-react";
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
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-accent" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Upload Job Photos</CardTitle>
            <CardDescription>
              Drag and drop multiple photos from your completed construction project (maximum {MAX_PHOTOS} photos)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-smooth hover:border-primary hover:bg-primary/5
            ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border'}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold mb-1">
                {isDragActive ? "Drop photos here..." : "Drag & drop photos"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse your files
              </p>
            </div>
          </div>
        </div>

        {photoCount > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm font-medium">
                  {photoCount} photo{photoCount !== 1 ? 's' : ''} ready
                </span>
              </div>
              <Button
                onClick={onProcess}
                disabled={isProcessing}
                className="gradient-accent hover:opacity-90 transition-smooth"
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Process with AI
                  </>
                )}
              </Button>
            </div>
            
            {isProcessing && processingProgress && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Progress value={(processingProgress.currentBatch / processingProgress.totalBatches) * 100} />
                <p className="text-sm text-muted-foreground text-center">
                  Processing batch {processingProgress.currentBatch} of {processingProgress.totalBatches}...
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
