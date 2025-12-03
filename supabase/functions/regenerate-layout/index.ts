import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photos, currentLayoutType, companyDetails, photoCount } = await req.json();

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No photos provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Regenerating layout for ${photos.length} photos, current type: ${currentLayoutType}`);

    // Build the prompt for AI
    const prompt = `You are an expert social media content strategist for construction/renovation companies.

Analyze these ${photos.length} construction project photos and suggest the BEST layout options for social media posting.

Company: ${companyDetails?.name || 'Construction Company'}
Description: ${companyDetails?.description || 'Professional construction services'}
Current layout type: ${currentLayoutType}
Photo count: ${photoCount}

Photo URLs for analysis (in order):
${photos.map((url: string, i: number) => `${i}: ${url}`).join('\n')}

Based on visual analysis of these photos, suggest 2-3 alternative layout options that would work well. Consider:
1. Before/after transformations (if photos show different stages)
2. Project progression storytelling
3. Best hero shots for single image posts
4. Visual variety and composition
5. Platform optimization (Instagram carousel, LinkedIn single post, etc.)

For each suggestion, provide:
- type: One of "Before/After", "Carousel", "Grid", "Slideshow", "Highlight", "Collage", "Triptych", "Story"
- description: A compelling description (under 100 chars)
- photoIndices: Array of indices (0-based) from the input photos array, in the order they should appear
- For Before/After: use beforePhotoIndex and afterPhotoIndex instead of photoIndices

Return JSON format:
{
  "layouts": [
    {
      "type": "Carousel",
      "description": "Project progression showing renovation stages",
      "photoIndices": [0, 2, 4, 1]
    },
    {
      "type": "Before/After", 
      "description": "Dramatic transformation showcase",
      "beforePhotoIndex": 0,
      "afterPhotoIndex": 3
    }
  ]
}

Important:
- Only suggest layout types that make sense for the photo count
- Prioritize quality over quantity
- Consider which photos best tell the construction story
- Return ONLY valid JSON, no markdown`;

    // Prepare messages with images
    const content: any[] = [{ type: "text", text: prompt }];
    
    // Add images (limit to first 10 to avoid token limits)
    const photoSubset = photos.slice(0, 10);
    for (const photoUrl of photoSubset) {
      content.push({
        type: "image_url",
        image_url: { url: photoUrl }
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI Response:', aiText.substring(0, 500));

    // Parse JSON from response
    let layouts = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        layouts = parsed.layouts || [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return fallback suggestions based on photo count
      layouts = generateFallbackLayouts(photoCount, currentLayoutType);
    }

    // Validate and clean up layouts
    const validatedLayouts = layouts
      .filter((layout: any) => layout.type && (layout.photoIndices || layout.beforePhotoIndex !== undefined))
      .map((layout: any) => ({
        ...layout,
        // Ensure indices are within bounds
        photoIndices: layout.photoIndices?.filter((i: number) => i >= 0 && i < photos.length),
        beforePhotoIndex: layout.beforePhotoIndex !== undefined && layout.beforePhotoIndex < photos.length ? layout.beforePhotoIndex : undefined,
        afterPhotoIndex: layout.afterPhotoIndex !== undefined && layout.afterPhotoIndex < photos.length ? layout.afterPhotoIndex : undefined,
      }))
      .filter((layout: any) => 
        (layout.photoIndices && layout.photoIndices.length > 0) || 
        (layout.beforePhotoIndex !== undefined && layout.afterPhotoIndex !== undefined)
      );

    return new Response(
      JSON.stringify({ layouts: validatedLayouts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-layout:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackLayouts(photoCount: number, currentType: string): any[] {
  const layouts = [];
  
  if (photoCount >= 2 && currentType !== 'Before/After') {
    layouts.push({
      type: 'Before/After',
      description: 'Compare start and end results',
      beforePhotoIndex: 0,
      afterPhotoIndex: photoCount - 1
    });
  }
  
  if (photoCount >= 3 && currentType !== 'Carousel') {
    layouts.push({
      type: 'Carousel',
      description: 'Swipeable project progression',
      photoIndices: Array.from({ length: Math.min(photoCount, 8) }, (_, i) => i)
    });
  }
  
  if (photoCount >= 4 && currentType !== 'Grid') {
    layouts.push({
      type: 'Grid',
      description: 'Multi-angle showcase',
      photoIndices: [0, 1, 2, 3]
    });
  }
  
  if (photoCount >= 5 && currentType !== 'Slideshow') {
    layouts.push({
      type: 'Slideshow',
      description: 'Full project story video',
      photoIndices: Array.from({ length: photoCount }, (_, i) => i)
    });
  }

  return layouts;
}
