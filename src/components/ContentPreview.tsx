import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Download, Copy } from "lucide-react";
import { toast } from "sonner";

interface ProcessedContent {
  photos: Array<{ url: string; timestamp?: string }>;
  captions: string[];
  hashtags: string[];
  layouts: Array<{ type: string; preview: string }>;
}

interface ContentPreviewProps {
  content: ProcessedContent;
}

export const ContentPreview = ({ content }: ContentPreviewProps) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleExport = () => {
    toast.info("Export feature coming soon!");
  };

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-display">Your Content is Ready!</CardTitle>
            <CardDescription>
              Review and export your social media content
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
            <Button className="gradient-primary">
              <Share2 className="mr-2 h-4 w-4" />
              Share to Social
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="captions">Captions</TabsTrigger>
            <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          </TabsList>
          
          <TabsContent value="photos" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {content.photos.map((photo, idx) => (
                <div key={idx} className="relative group overflow-hidden rounded-lg border border-border hover:shadow-medium transition-smooth">
                  <img 
                    src={photo.url} 
                    alt={`Construction photo ${idx + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-smooth flex items-end p-3">
                    <p className="text-xs font-medium text-foreground">Photo {idx + 1}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {content.photos.length} photos organized in chronological order by AI
            </p>
          </TabsContent>
          
          <TabsContent value="layouts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.layouts.map((layout, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 hover:shadow-medium transition-smooth space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold capitalize">{layout.type} Layout</p>
                    {layout.preview && (
                      <p className="text-xs text-muted-foreground">{layout.preview}</p>
                    )}
                  </div>
                  
                  {/* Layout Preview - Case-insensitive matching */}
                  {layout.type.toLowerCase().includes('carousel') && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {content.photos.slice(0, 4).map((photo, pIdx) => (
                        <img 
                          key={pIdx}
                          src={photo.url} 
                          alt={`Preview ${pIdx + 1}`}
                          className="h-24 w-24 object-cover rounded border border-border flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                  
                  {(layout.type.toLowerCase().includes('before') && layout.type.toLowerCase().includes('after')) && content.photos.length >= 2 && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <img 
                          src={content.photos[0].url} 
                          alt="Before"
                          className="w-full aspect-square object-cover rounded border border-border"
                        />
                        <p className="text-xs text-center text-muted-foreground">Before</p>
                      </div>
                      <div className="space-y-1">
                        <img 
                          src={content.photos[content.photos.length - 1].url} 
                          alt="After"
                          className="w-full aspect-square object-cover rounded border border-border"
                        />
                        <p className="text-xs text-center text-muted-foreground">After</p>
                      </div>
                    </div>
                  )}
                  
                  {(layout.type.toLowerCase().includes('single') || layout.type.toLowerCase().includes('highlight')) && content.photos.length > 0 && (
                    <img 
                      src={content.photos[0].url} 
                      alt="Highlight"
                      className="w-full aspect-video object-cover rounded border border-border"
                    />
                  )}
                  
                  {layout.type.toLowerCase().includes('grid') && (
                    <div className="grid grid-cols-2 gap-2">
                      {content.photos.slice(0, 4).map((photo, pIdx) => (
                        <img 
                          key={pIdx}
                          src={photo.url} 
                          alt={`Grid ${pIdx + 1}`}
                          className="w-full aspect-square object-cover rounded border border-border"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="captions" className="space-y-4">
            {content.captions.map((caption, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 hover:shadow-soft transition-smooth">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm flex-1">{caption}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(caption)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="hashtags" className="space-y-4">
            <div className="border border-border rounded-lg p-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {content.hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => handleCopy(content.hashtags.map(t => `#${t}`).join(' '))}
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy All Hashtags
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
