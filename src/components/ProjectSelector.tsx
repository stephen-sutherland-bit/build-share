import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FolderOpen, Trash2, Clock, Image, FileText, ChevronRight } from 'lucide-react';
import { Project } from '@/hooks/useProjects';
import { formatDistanceToNow } from 'date-fns';

interface ProjectSelectorProps {
  projects: Project[];
  loading: boolean;
  onSelect: (project: Project) => void;
  onDelete: (id: string) => void;
}

export const ProjectSelector = ({ projects, loading, onSelect, onDelete }: ProjectSelectorProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (loading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg font-display tracking-tight">Saved Projects</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 shadow-soft bg-card/80 backdrop-blur-sm hover:shadow-medium transition-smooth">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-lg font-display tracking-tight">Saved Projects</CardTitle>
            <CardDescription className="text-sm">
              Continue working on a previous project
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {projects.map((project, idx) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: idx * 0.05 }}
              className="group flex items-center justify-between p-4 border border-border/50 rounded-xl hover:border-primary/30 hover:bg-muted/30 hover:shadow-soft transition-all duration-200 cursor-pointer"
              onClick={() => onSelect(project)}
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold tracking-tight truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h4>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5" />
                    {project.photos.length} photos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {project.layouts.length} layouts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-1" />
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                      disabled={deletingId === project.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-border/50 shadow-strong">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display tracking-tight">Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{project.name}". This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-border/50">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(project.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
