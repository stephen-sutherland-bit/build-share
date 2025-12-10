import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface ProcessedContent {
  photos: Array<{ url: string; timestamp?: string }>;
  captions: Array<{ platform?: string; text: string } | string>;
  hashtags: string[];
  layouts: Array<{ 
    type: string; 
    description?: string;
    preview?: string;
    beforePhotoIndex?: number;
    afterPhotoIndex?: number;
    photoIndices?: number[];
  }>;
}

interface CompanyDetails {
  name: string;
  description: string;
  website?: string;
  phone?: string;
}

export interface Project {
  id: string;
  name: string;
  photos: ProcessedContent['photos'];
  captions: ProcessedContent['captions'];
  hashtags: string[];
  layouts: ProcessedContent['layouts'];
  company_details: CompanyDetails;
  created_at: string;
  updated_at: string;
}

export const useProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setProjects(data?.map(p => {
        // Parse layouts ensuring photoIndices are preserved
        const rawLayouts = p.layouts as unknown as ProcessedContent['layouts'] || [];
        const layouts = rawLayouts.map(layout => ({
          ...layout,
          // Ensure indices are numbers, not strings
          beforePhotoIndex: layout.beforePhotoIndex !== undefined ? Number(layout.beforePhotoIndex) : undefined,
          afterPhotoIndex: layout.afterPhotoIndex !== undefined ? Number(layout.afterPhotoIndex) : undefined,
          photoIndices: layout.photoIndices?.map(idx => Number(idx)),
        }));
        
        return {
          id: p.id,
          name: p.name,
          photos: p.photos as unknown as ProcessedContent['photos'],
          captions: p.captions as unknown as ProcessedContent['captions'],
          hashtags: p.hashtags as unknown as string[],
          layouts,
          company_details: p.company_details as unknown as CompanyDetails,
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      }) || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const saveProject = async (
    name: string,
    content: ProcessedContent,
    companyDetails: CompanyDetails,
    existingId?: string
  ): Promise<string | null> => {
    if (!user) {
      toast.error('You must be logged in to save projects');
      return null;
    }

    try {
      if (existingId) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name,
            photos: JSON.parse(JSON.stringify(content.photos)) as Json,
            captions: JSON.parse(JSON.stringify(content.captions)) as Json,
            hashtags: JSON.parse(JSON.stringify(content.hashtags)) as Json,
            layouts: JSON.parse(JSON.stringify(content.layouts)) as Json,
            company_details: JSON.parse(JSON.stringify(companyDetails)) as Json,
          })
          .eq('id', existingId)
          .eq('user_id', user.id);

        if (error) throw error;
        
        toast.success('Project updated successfully!');
        await fetchProjects();
        return existingId;
      } else {
        // Create new project
        const { data, error } = await supabase
          .from('projects')
          .insert([{
            user_id: user.id,
            name,
            photos: JSON.parse(JSON.stringify(content.photos)) as Json,
            captions: JSON.parse(JSON.stringify(content.captions)) as Json,
            hashtags: JSON.parse(JSON.stringify(content.hashtags)) as Json,
            layouts: JSON.parse(JSON.stringify(content.layouts)) as Json,
            company_details: JSON.parse(JSON.stringify(companyDetails)) as Json,
          }])
          .select('id')
          .single();

        if (error) throw error;
        
        toast.success('Project saved successfully!');
        await fetchProjects();
        return data.id;
      }
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
      return null;
    }
  };

  const deleteProject = async (id: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Project deleted');
      await fetchProjects();
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      return false;
    }
  };

  return {
    projects,
    loading,
    saveProject,
    deleteProject,
    refreshProjects: fetchProjects,
  };
};
