import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photos, companyDetails } = await req.json();
    
    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No photos provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${photos.length} photos for company: ${companyDetails?.name}`);

    // Process photos in batches of 10 (LLM limit)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      batches.push(photos.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches of photos`);

    // Process each batch
    const batchResults = [];
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} photos`);

      const messages = [
        {
          role: 'system',
          content: `You are a social media content expert specializing in construction industry posts.
Analyze construction project photos and identify:
1. Project progression stages (demolition → structural → finishing)
2. Clear before/after transformation pairs (same location/angle at different stages)
3. Best photos for showcasing work quality and craftsmanship

For layouts, ONLY use these EXACT types:
- "before-after" - Identify specific before and after photo indices showing transformation
- "carousel" - Project progression sequence (3-5 photos)
- "grid" - Multiple angles or detail shots (4 photos)
- "highlight" - Single standout photo

When identifying before/after pairs, look for:
- Same location/angle at different project stages
- Clear visual transformation (demo vs completed, structural vs finished)
- Strong contrast that tells a compelling story`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Company: ${companyDetails?.name || 'Construction Company'}
Description: ${companyDetails?.description || 'Professional construction services'}

This is batch ${batchIndex + 1} of ${batches.length}. Total photos: ${photos.length}

Analyze these construction photos (indices ${batchIndex * BATCH_SIZE} to ${Math.min((batchIndex + 1) * BATCH_SIZE - 1, photos.length - 1)}) and provide:

1. chronologicalOrder: Array of photo indices showing project progression
2. captions: Array of objects with "platform" (Instagram/LinkedIn) and "text" (engaging caption)
3. hashtags: 10-15 relevant construction industry hashtags
4. layouts: Array of layout objects with:
   - type: MUST be exactly "before-after", "carousel", "grid", or "highlight"
   - description: What this layout showcases
   - For "before-after": include beforePhotoIndex and afterPhotoIndex (must identify actual transformation)
   - For "carousel": include photoIndices array (3-5 photos showing progression)
   - For "grid": include photoIndices array (4 photos)
   - For "highlight": include photoIndices array (1 photo)

Example response format:
{
  "chronologicalOrder": [0, 2, 1, 3],
  "captions": [
    {"platform": "Instagram", "text": "Transformation complete! 🔨..."},
    {"platform": "LinkedIn", "text": "Proud to showcase..."}
  ],
  "hashtags": ["construction", "renovation"],
  "layouts": [
    {
      "type": "before-after",
      "description": "Kitchen demolition to completed renovation",
      "beforePhotoIndex": 0,
      "afterPhotoIndex": 3
    },
    {
      "type": "carousel",
      "description": "Full project timeline",
      "photoIndices": [0, 1, 2, 3]
    }
  ]
}

Return ONLY valid JSON.`
            },
            ...batch.map((photo: any) => ({
              type: 'image_url',
              image_url: {
                url: photo.url
              }
            }))
          ]
        }
      ];

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: messages,
          max_tokens: 2000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI Gateway error:', aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to process photos with AI' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      console.log(`Batch ${batchIndex + 1} AI Response received:`, content.substring(0, 200));

      // Try to parse JSON from the response
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        const batchResult = JSON.parse(jsonStr);
        batchResults.push(batchResult);
      } catch (parseError) {
        console.error(`Failed to parse batch ${batchIndex + 1} AI response as JSON:`, parseError);
        // Fallback: create basic structure from text response
        batchResults.push({
          chronologicalOrder: batch.map((_: any, idx: number) => batchIndex * BATCH_SIZE + idx),
          captions: [content.substring(0, 280)],
          hashtags: ['construction', 'building', 'renovation', 'contractor'],
          layouts: [
            { type: 'grid', description: 'Standard grid layout' },
            { type: 'before-after', description: 'Side-by-side comparison' }
          ]
        });
      }
    }

    // Combine results from all batches
    const result = {
      chronologicalOrder: batchResults.flatMap(r => r.chronologicalOrder || []),
      captions: batchResults.flatMap(r => r.captions || []),
      hashtags: [...new Set(batchResults.flatMap(r => r.hashtags || []))], // Remove duplicates
      layouts: batchResults.flatMap(r => r.layouts || [])
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          chronologicalOrder: result.chronologicalOrder || photos.map((_: any, idx: number) => idx),
          captions: result.captions || [],
          hashtags: result.hashtags || [],
          layouts: result.layouts || []
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-photos function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
