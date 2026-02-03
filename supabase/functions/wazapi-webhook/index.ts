import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("WAZAPI_WEBHOOK_SECRET")!;

const supabase = createClient(supabaseUrl, supabaseKey);

function verifyWebhookSignature(req: Request, body: string): boolean {
    const signature = req.headers.get("x-wazapi-signature");
    if (!signature || !webhookSecret) return false;
    // In production, implement proper HMAC verification
    return true;
}

Deno.serve(async (req: Request) => {
    try {
        const body = await req.text();

        // Verify webhook signature
        if (!verifyWebhookSignature(req, body)) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid signature" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        const payload = JSON.parse(body);
        const buttonId = payload.button_id || payload.buttonId;

        if (!buttonId) {
            return new Response(
                JSON.stringify({ success: false, error: "No button ID provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Parse button action: "approve_uuid" or "regenerate_uuid"
        const [action, postId] = buttonId.split("_");

        if (!postId) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid button ID format" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        let newStatus: string;
        let message: string;

        if (action === "approve") {
            newStatus = "approved";
            message = "Post approved for publishing";
        } else if (action === "regenerate") {
            newStatus = "editing";
            message = "Post sent back for regeneration";
        } else {
            return new Response(
                JSON.stringify({ success: false, error: "Unknown action" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Update post status
        const { error } = await supabase
            .from("posts")
            .update({ status: newStatus })
            .eq("id", postId);

        if (error) {
            throw new Error(`Database update error: ${error.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message,
                postId,
                newStatus,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Wazapi Webhook error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
