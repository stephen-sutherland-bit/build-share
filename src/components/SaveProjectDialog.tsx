import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

interface SaveProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  defaultName?: string;
  isUpdate?: boolean;
}

export const SaveProjectDialog = ({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultName = '', 
  isUpdate = false 
}: SaveProjectDialogProps) => {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Update Project' : 'Save Project'}</DialogTitle>
          <DialogDescription>
            {isUpdate 
              ? 'Update the project name or save your changes.'
              : 'Give your project a name so you can find it later.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., Kitchen Renovation - Smith Residence"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || saving}
            className="gradient-primary"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : isUpdate ? 'Update' : 'Save Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
