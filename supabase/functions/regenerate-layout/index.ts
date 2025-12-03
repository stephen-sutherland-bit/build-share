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

    // Don't send actual photo URLs to avoid token limits with base64 data
    // Instead, generate smart suggestions based on photo count and current layout
    const prompt = `You are an expert social media content strategist for construction/renovation companies.

Based on the following information, suggest 2-3 alternative layout options for social media posting.

Company: ${companyDetails?.name || 'Construction Company'}
Description: ${companyDetails?.description || 'Professional construction services'}
Current layout type: ${currentLayoutType}
Number of photos available: ${photoCount}

Suggest different layout types from the current one. Available layout types:
- Before/After (exactly 2 photos - photo index 0 as before, last photo as after)
- Carousel (2-10 photos - great for project progression)
- Grid (2-9 photos - multi-angle showcase)
- Slideshow (3-50 photos - video-ready sequence)
- Highlight (1 photo - hero image)
- Collage (3-4 photos - artistic combination)
- Triptych (3 photos - three-panel story)
- Story (1 photo - vertical format)

For each suggestion, provide:
- type: The layout type name exactly as listed above
- description: A compelling description (under 100 chars) explaining why this layout works
- photoIndices: Array of indices (0-based) in recommended order
- For Before/After: use beforePhotoIndex (typically 0) and afterPhotoIndex (typically last photo)

Return JSON format:
{
  "layouts": [
    {
      "type": "Carousel",
      "description": "Showcase project progression in swipeable format",
      "photoIndices": [0, 1, 2, 3, 4]
    },
    {
      "type": "Before/After", 
      "description": "Dramatic transformation comparison",
      "beforePhotoIndex": 0,
      "afterPhotoIndex": ${photoCount - 1}
    }
  ]
}

Rules:
- Only suggest layouts that make sense for ${photoCount} photos
- Don't suggest ${currentLayoutType} since that's the current type
- Suggest diverse options (different from each other)
- Return ONLY valid JSON, no markdown`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
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
