import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const nanoBananaApiKey = Deno.env.get("NANO_BANANA_API_KEY")!;
const nanoBananaUrl = Deno.env.get("NANO_BANANA_API_URL") || "https://api.nanobanana.com/v1";

const supabase = createClient(supabaseUrl, supabaseKey);

const QWEI_DESIGN_PROMPT = `Minimalist editorial tech photography, soft diffused lighting, 
white and light gray color palette, clean composition, 8k ultra high definition, 
professional product photography style, subtle shadows, negative space, 
Swiss design aesthetics, quiet tech mood`;

async function generateImage(title: string): Promise<{ imageUrl: string; prompt: string }> {
    const contextPrompt = `${QWEI_DESIGN_PROMPT}. Context: ${title}`;

    const response = await fetch(`${nanoBananaUrl}/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${nanoBananaApiKey}`,
        },
        body: JSON.stringify({
            prompt: contextPrompt,
            width: 1080,
            height: 1080,
            num_inference_steps: 30,
        }),
    });

    if (!response.ok) {
        throw new Error(`Nano Banana API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        imageUrl: data.image_url || data.output_url,
        prompt: contextPrompt,
    };
}

Deno.serve(async (req: Request) => {
    try {
        const { record } = await req.json();
        const postId = record.id;
        const sourceTitle = record.source_title;

        if (!sourceTitle) {
            return new Response(
                JSON.stringify({ success: false, error: "No source_title provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Generate image using Nano Banana
        const { imageUrl, prompt } = await generateImage(sourceTitle);

        // Update the post with generated image
        const { error } = await supabase
            .from("posts")
            .update({
                image_url: imageUrl,
                image_prompt: prompt,
                status: "pending_approval",
            })
            .eq("id", postId);

        if (error) {
            throw new Error(`Database update error: ${error.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Image generated successfully",
                postId,
                imageUrl,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("QWEI Designer error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
