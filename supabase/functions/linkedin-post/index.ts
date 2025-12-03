import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { userId, caption, hashtags, imageUrls } = body;

    if (!userId || !caption) {
      return new Response(
        JSON.stringify({ error: 'userId and caption are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Posting to LinkedIn for user ${userId}`);

    // Get user's LinkedIn connection
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .single();

    if (connError || !connection) {
      console.error('No LinkedIn connection found:', connError);
      return new Response(
        JSON.stringify({ error: 'LinkedIn account not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      console.error('LinkedIn token expired');
      return new Response(
        JSON.stringify({ error: 'LinkedIn token expired. Please reconnect your account.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = connection.access_token;
    const authorId = connection.platform_user_id;

    if (!authorId) {
      return new Response(
        JSON.stringify({ error: 'LinkedIn profile ID not found. Please reconnect your account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine caption and hashtags
    const fullText = hashtags && hashtags.length > 0 
      ? `${caption}\n\n${hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')}`
      : caption;

    let postBody: any;

    // If we have images, upload them first
    if (imageUrls && imageUrls.length > 0) {
      console.log(`Uploading ${imageUrls.length} images to LinkedIn...`);

      const uploadedAssets: string[] = [];

      for (const imageUrl of imageUrls) {
        try {
          // Step 1: Register upload
          const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: `urn:li:person:${authorId}`,
                serviceRelationships: [{
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent'
                }]
              }
            })
          });

          if (!registerResponse.ok) {
            const errorText = await registerResponse.text();
            console.error('Register upload failed:', errorText);
            continue;
          }

          const registerData = await registerResponse.json();
          const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
          const asset = registerData.value.asset;

          // Step 2: Fetch the image data
          // If it's a base64 data URL, convert it
          let imageBuffer: ArrayBuffer;
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            imageBuffer = bytes.buffer;
          } else {
            const imageResponse = await fetch(imageUrl);
            imageBuffer = await imageResponse.arrayBuffer();
          }

          // Step 3: Upload the image
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            body: imageBuffer
          });

          if (uploadResponse.ok || uploadResponse.status === 201) {
            uploadedAssets.push(asset);
            console.log(`Image uploaded successfully: ${asset}`);
          } else {
            console.error('Image upload failed:', await uploadResponse.text());
          }
        } catch (imgError) {
          console.error('Error uploading image:', imgError);
        }
      }

      // Create post with images
      if (uploadedAssets.length > 0) {
        if (uploadedAssets.length === 1) {
          // Single image post
          postBody = {
            author: `urn:li:person:${authorId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: fullText
                },
                shareMediaCategory: 'IMAGE',
                media: [{
                  status: 'READY',
                  media: uploadedAssets[0]
                }]
              }
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
          };
        } else {
          // Multiple images post
          postBody = {
            author: `urn:li:person:${authorId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                  text: fullText
                },
                shareMediaCategory: 'IMAGE',
                media: uploadedAssets.map(asset => ({
                  status: 'READY',
                  media: asset
                }))
              }
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
            }
          };
        }
      } else {
        // Fallback to text-only if all image uploads failed
        console.warn('All image uploads failed, posting text only');
        postBody = {
          author: `urn:li:person:${authorId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: fullText
              },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        };
      }
    } else {
      // Text-only post
      postBody = {
        author: `urn:li:person:${authorId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: fullText
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
    }

    // Create the post
    console.log('Creating LinkedIn post...');
    const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postBody)
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Post creation failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create LinkedIn post', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const postId = postResponse.headers.get('x-restli-id');
    console.log('Post created successfully:', postId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        postId,
        message: 'Successfully posted to LinkedIn!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LinkedIn post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
