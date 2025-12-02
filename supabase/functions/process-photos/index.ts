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
          content: `You are an elite social media strategist and visual content curator for premium construction companies. Your layouts must be PUBLICATION-READY for professional social media pages.

## CORE PRINCIPLE: Every layout must look like it was designed by a professional marketing agency.

## PHOTO QUALITY ASSESSMENT (Rate each photo mentally):
- EXCELLENT: Sharp focus, good lighting, clear subject, professional composition, no clutter
- GOOD: Decent quality, clear subject, acceptable lighting
- POOR: Blurry, dark, cluttered, unflattering angle, messy background
- NEVER include POOR quality photos in any layout

## LAYOUT-SPECIFIC RULES:

### BEFORE-AFTER (Transformation Story)
- MUST show the SAME space/angle at different stages
- Before: Demolition, old condition, structural work
- After: Clean, finished, polished result
- Dramatic contrast is essential - skip if no clear transformation exists
- Both photos must be similar quality and framing

### CAROUSEL (Instagram Multi-Post)
- Tell a VISUAL STORY with clear progression
- Start with attention-grabbing shot, end with impressive result
- Each photo must be visually distinct (different angles/areas)
- NO similar-looking consecutive photos
- Ideal: Demo → Progress → Detail → Result

### GRID (4-Photo Showcase)
- VARIETY is key: different rooms, angles, or details
- Balance composition: mix wide shots with details
- Avoid 4 similar-looking photos
- Each quadrant should offer something unique

### HIGHLIGHT (Hero Shot)
- The SINGLE BEST photo that represents the project
- Must be: sharp, well-lit, impressive scope visible
- Ideal for: finished spaces, dramatic transformations, craftsmanship details

### SLIDESHOW/VIDEO (Reel Content)
- Chronological journey through the project
- Include variety: wide establishing shots, progress, details, reveals
- Pacing: Start strong, build through middle, end with best shots
- Remove redundant/similar consecutive photos

### COLLAGE (Feature + Supporting)
- Main photo (large): The hero shot - best single image
- Supporting photos (3 smaller): Complementary angles/details
- Main photo must be significantly better than supporting ones

### TRIPTYCH (3-Panel Story)
- Clear narrative: Beginning → Middle → End
- OR: Three complementary angles of the same impressive result
- Visual balance across all three panels
- Each panel must be strong enough to stand alone

### STORY (Vertical Format)
- Portrait-oriented or cropped-friendly
- Single powerful image
- Avoid wide landscape shots that won't work vertical

## CRITICAL QUALITY RULES:
1. NEVER use blurry or dark photos
2. NEVER repeat the same photo across layouts
3. NEVER include cluttered/messy shots unless showing "before" state
4. ALWAYS prioritize visual variety within each layout
5. ALWAYS ensure photos work together aesthetically
6. SKIP a layout type entirely if you don't have suitable photos for it

## PROJECT STATUS DETECTION:
- IN-PROGRESS: exposed framing, debris, tools visible, unfinished surfaces
- COMPLETED: clean finished surfaces, no construction materials, polished details`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Company: ${companyDetails?.name || 'Construction Company'}
Description: ${companyDetails?.description || 'Professional construction services'}

Batch ${batchIndex + 1} of ${batches.length}. Analyzing photos ${batchIndex * BATCH_SIZE} to ${Math.min((batchIndex + 1) * BATCH_SIZE - 1, photos.length - 1)}.

## YOUR TASK:
Analyze these ${batch.length} construction photos with a PROFESSIONAL MARKETING EYE.

## REQUIRED OUTPUT:

1. **chronologicalOrder**: Indices 0-${batch.length - 1} arranged by project stage (demo→structure→finish)

2. **captions**: Platform-optimized captions
   - Instagram: Engaging, emoji-friendly, storytelling
   - LinkedIn: Professional, business-focused, achievement-oriented

3. **hashtags**: 10-15 relevant, trending construction hashtags

4. **projectStatus**: "completed" or "in-progress"

5. **layouts**: Create 4-6 PUBLICATION-READY layouts. For each:
   - **type**: before-after, carousel, grid, highlight, slideshow, collage, triptych, or story
   - **description**: Compelling 1-2 sentence description of what makes this layout special
   - **Photo indices**: Only include photos that meet quality standards

## PHOTO SELECTION CRITERIA FOR EACH LAYOUT:
- Before-After: beforePhotoIndex, afterPhotoIndex (SAME location, DIFFERENT stages)
- Carousel: photoIndices [3-8 photos showing clear progression, each visually distinct]
- Grid: photoIndices [4 photos with maximum variety]
- Highlight: photoIndices [1 - THE single best photo]
- Slideshow: photoIndices [chronological sequence, no redundant shots]
- Collage: photoIndices [4 - first is hero, others complement it]
- Triptych: photoIndices [3 - clear narrative or complementary trio]
- Story: photoIndices [1 - vertical-friendly standout]

## QUALITY GATE:
- If a layout type cannot be done well with available photos, SKIP IT
- Better to have 4 excellent layouts than 8 mediocre ones

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
      "type": "carousel",
      "description": "Step-by-step renovation journey",
      "photoIndices": [0, 1, 2, 3, 4]
    },
    {
      "type": "collage",
      "description": "Project overview with key highlights",
      "photoIndices": [3, 0, 1, 2]
    },
    {
      "type": "triptych",
      "description": "From demolition through progress to completion",
      "photoIndices": [0, 2, 3]
    },
    {
      "type": "highlight",
      "description": "The finished kitchen in all its glory",
      "photoIndices": [3]
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
