import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN")!;
const instagramAccountId = Deno.env.get("META_INSTAGRAM_ACCOUNT_ID")!;
const linkedinAccessToken = Deno.env.get("LINKEDIN_ACCESS_TOKEN")!;
const linkedinOrgId = Deno.env.get("LINKEDIN_ORGANIZATION_ID")!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function publishToInstagram(imageUrl: string, caption: string): Promise<string> {
    // Step 1: Create media container
    const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image_url: imageUrl,
                caption: caption,
                access_token: metaAccessToken,
            }),
        }
    );

    if (!containerResponse.ok) {
        throw new Error(`Instagram container error: ${containerResponse.status}`);
    }

    const containerData = await containerResponse.json();
    const containerId = containerData.id;

    // Step 2: Publish the container
    const publishResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: metaAccessToken,
            }),
        }
    );

    if (!publishResponse.ok) {
        throw new Error(`Instagram publish error: ${publishResponse.status}`);
    }

    const publishData = await publishResponse.json();
    return publishData.id;
}

async function publishToLinkedIn(imageUrl: string, text: string): Promise<string> {
    // Step 1: Register image upload
    const registerResponse = await fetch(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${linkedinAccessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                registerUploadRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    owner: `urn:li:organization:${linkedinOrgId}`,
                    serviceRelationships: [
                        {
                            relationshipType: "OWNER",
                            identifier: "urn:li:userGeneratedContent",
                        },
                    ],
                },
            }),
        }
    );

    if (!registerResponse.ok) {
        throw new Error(`LinkedIn register error: ${registerResponse.status}`);
    }

    const registerData = await registerResponse.json();
    const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Upload image
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${linkedinAccessToken}`,
        },
        body: imageBlob,
    });

    // Step 3: Create post
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${linkedinAccessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            author: `urn:li:organization:${linkedinOrgId}`,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: { text },
                    shareMediaCategory: "IMAGE",
                    media: [
                        {
                            status: "READY",
                            media: asset,
                        },
                    ],
                },
            },
            visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
            },
        }),
    });

    if (!postResponse.ok) {
        throw new Error(`LinkedIn post error: ${postResponse.status}`);
    }

    const postData = await postResponse.json();
    return postData.id;
}

Deno.serve(async (req: Request) => {
    try {
        const { record } = await req.json();
        const postId = record.id;
        const { image_url, caption_instagram, copy_linkedin } = record;

        const results: { instagram?: string; linkedin?: string; errors: string[] } = {
            errors: [],
        };

        // Publish to Instagram
        try {
            results.instagram = await publishToInstagram(image_url, caption_instagram);
        } catch (error) {
            results.errors.push(`Instagram: ${error.message}`);
        }

        // Publish to LinkedIn
        try {
            results.linkedin = await publishToLinkedIn(image_url, copy_linkedin);
        } catch (error) {
            results.errors.push(`LinkedIn: ${error.message}`);
        }

        // Update post status
        const finalStatus = results.errors.length === 0 ? "published" : "failed";
        const { error } = await supabase
            .from("posts")
            .update({
                status: finalStatus,
                published_at: finalStatus === "published" ? new Date().toISOString() : null,
            })
            .eq("id", postId);

        if (error) {
            results.errors.push(`Database: ${error.message}`);
        }

        return new Response(
            JSON.stringify({
                success: results.errors.length === 0,
                message: finalStatus === "published" ? "Published successfully" : "Publishing partially failed",
                postId,
                results,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Social Publisher error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
