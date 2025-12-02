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

IMPORTANT: The project may be COMPLETED or IN-PROGRESS. Analyze visual cues:
- IN-PROGRESS indicators: exposed framing, debris, tools visible, unfinished surfaces, construction equipment
- COMPLETED indicators: clean finished surfaces, no visible construction materials, polished details

Analyze construction project photos and identify:
1. Project status (completed or in-progress)
2. Project progression stages (demolition → structural → finishing)
3. Clear before/after transformation pairs (same location/angle at different stages)
4. Best photos for showcasing work quality and craftsmanship

For layouts, ONLY use these EXACT types:
- "before-after" - Identify specific before and after photo indices showing transformation (skip if project is early in-progress with no clear transformation)
- "carousel" - Project progression sequence (3-5 photos showing stages)
- "grid" - Multiple angles or detail shots (4 photos)
- "highlight" - Single standout photo
- "slideshow" - Large photo sequence for video/reel content (10-30+ photos, ideal for showing complete project journey)

For IN-PROGRESS projects:
- Use captions that highlight current progress, not completion
- Focus on "carousel" and "slideshow" layouts to show work progression
- Skip "before-after" if no clear transformation exists yet
- Emphasize stages completed so far

For COMPLETED projects:
- Use transformation-focused captions
- Prioritize "before-after" layouts with clear contrast
- Showcase finished quality in "highlight" layouts

When identifying before/after pairs:
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

1. chronologicalOrder: Array of LOCAL photo indices (0-${batch.length - 1}) showing project progression within THIS batch only
2. captions: Array of objects with "platform" (Instagram/LinkedIn) and "text" (engaging caption appropriate to project status)
3. hashtags: 10-15 relevant construction industry hashtags
4. projectStatus: Either "completed" or "in-progress" based on visual analysis
5. layouts: Array of layout objects with:
   - type: MUST be exactly "before-after", "carousel", "grid", "highlight", or "slideshow"
   - description: What this layout showcases
   - For "before-after": include beforePhotoIndex and afterPhotoIndex (LOCAL indices, skip if no transformation visible)
   - For "carousel": include photoIndices array (3-5 LOCAL indices showing progression)
   - For "grid": include photoIndices array (4 LOCAL indices)
   - For "highlight": include photoIndices array (1 LOCAL index)
   - For "slideshow": include photoIndices array (10+ LOCAL indices for full project sequence)

Example response format:
{
  "chronologicalOrder": [0, 2, 1, 3],
  "projectStatus": "completed",
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
      "type": "slideshow",
      "description": "Complete project journey for video reel",
      "photoIndices": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
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

    // Adjust batch indices to global indices for layouts
    const adjustedLayouts = [];
    for (let batchIndex = 0; batchIndex < batchResults.length; batchIndex++) {
      const offset = batchIndex * BATCH_SIZE;
      const batchLayouts = (batchResults[batchIndex].layouts || []).map((layout: any) => ({
        ...layout,
        beforePhotoIndex: layout.beforePhotoIndex !== undefined ? layout.beforePhotoIndex + offset : undefined,
        afterPhotoIndex: layout.afterPhotoIndex !== undefined ? layout.afterPhotoIndex + offset : undefined,
        photoIndices: layout.photoIndices ? layout.photoIndices.map((idx: number) => idx + offset) : undefined
      }));
      adjustedLayouts.push(...batchLayouts);
    }

    // Second AI pass: Get global chronological order across all photos
    console.log('Making second AI pass for global chronological ordering...');
    
    const orderingMessages = [
      {
        role: 'system',
        content: 'You are analyzing construction photos to determine their chronological order. Identify project progression stages: demolition → structural work → finishing → completed. Return ONLY a JSON array of photo indices in chronological order.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze ALL ${photos.length} construction photos and return them in chronological order (earliest to latest stage of construction). 

Consider:
- Demolition/clearing stages come first
- Structural/framing work comes next
- Finishing work (drywall, painting, fixtures) comes later
- Completed/clean photos come last

Return ONLY a JSON object: {"chronologicalOrder": [array of indices 0 to ${photos.length - 1}]}`
          },
          ...photos.slice(0, 80).map((photo: any) => ({
            type: 'image_url',
            image_url: { url: photo.url }
          }))
        ]
      }
    ];

    const orderingResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: orderingMessages,
        max_tokens: 1000,
      }),
    });

    let globalChronologicalOrder = photos.map((_: any, idx: number) => idx); // fallback
    
    if (orderingResponse.ok) {
      const orderingData = await orderingResponse.json();
      const orderingContent = orderingData.choices?.[0]?.message?.content || '';
      console.log('Global ordering AI response:', orderingContent.substring(0, 200));
      
      try {
        const jsonMatch = orderingContent.match(/```json\n([\s\S]*?)\n```/) || orderingContent.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : orderingContent;
        const orderingResult = JSON.parse(jsonStr);
        globalChronologicalOrder = orderingResult.chronologicalOrder || globalChronologicalOrder;
      } catch (e) {
        console.error('Failed to parse ordering response:', e);
      }
    }

    // Combine results from all batches
    const result = {
      chronologicalOrder: globalChronologicalOrder,
      captions: batchResults.flatMap(r => r.captions || []),
      hashtags: [...new Set(batchResults.flatMap(r => r.hashtags || []))],
      layouts: adjustedLayouts,
      projectStatus: batchResults[0]?.projectStatus || 'in-progress'
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          chronologicalOrder: result.chronologicalOrder,
          captions: result.captions || [],
          hashtags: result.hashtags || [],
          layouts: result.layouts || [],
          projectStatus: result.projectStatus
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
