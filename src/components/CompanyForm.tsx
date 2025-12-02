import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, Save } from "lucide-react";

interface CompanyDetails {
  name: string;
  description: string;
  website?: string;
  phone?: string;
}

interface CompanyFormProps {
  onSave: (details: CompanyDetails) => void;
}

export const CompanyForm = ({ onSave }: CompanyFormProps) => {
  const [details, setDetails] = useState<CompanyDetails>({
    name: "",
    description: "",
    website: "",
    phone: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (details.name && details.description) {
      onSave(details);
    }
  };

  return (
    <Card className="shadow-medium border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Company Details</CardTitle>
            <CardDescription>
              Enter your construction company information for branded content
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                placeholder="ABC Construction Co."
                value={details.name}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                required
                className="transition-smooth"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                className="transition-smooth"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourcompany.com"
              value={details.website}
              onChange={(e) => setDetails({ ...details, website: e.target.value })}
              className="transition-smooth"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Company Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your company's services, specialties, and what makes you unique..."
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
              required
              rows={4}
              className="transition-smooth resize-none"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full md:w-auto gradient-primary hover:opacity-90 transition-smooth"
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Company Details
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
