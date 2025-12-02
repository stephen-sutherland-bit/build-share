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
        <Tabs defaultValue="layouts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="captions">Captions</TabsTrigger>
            <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          </TabsList>
          
          <TabsContent value="layouts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.layouts.map((layout, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 hover:shadow-medium transition-smooth">
                  <div className="aspect-square bg-muted rounded-lg mb-3" />
                  <p className="text-sm font-medium capitalize">{layout.type} Layout</p>
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
