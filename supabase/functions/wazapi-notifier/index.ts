import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const wazapiKey = Deno.env.get("WAZAPI_API_KEY")!;
const wazapiInstanceId = Deno.env.get("WAZAPI_INSTANCE_ID")!;
const adminPhone = Deno.env.get("WAZAPI_ADMIN_PHONE")!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface WazapiButtonMessage {
    phone: string;
    message: string;
    imageUrl?: string;
    buttons: Array<{
        id: string;
        text: string;
    }>;
}

async function sendWhatsAppWithButtons(data: WazapiButtonMessage): Promise<void> {
    const response = await fetch(`https://api.wazapi.com/v1/messages/button`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${wazapiKey}`,
            "X-Instance-Id": wazapiInstanceId,
        },
        body: JSON.stringify({
            to: data.phone,
            type: "button",
            body: data.message,
            mediaUrl: data.imageUrl,
            buttons: data.buttons,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wazapi API error: ${response.status} - ${errorText}`);
    }
}

Deno.serve(async (req: Request) => {
    try {
        const { record } = await req.json();
        const postId = record.id;
        const { source_title, caption_instagram, image_url } = record;

        // Build approval message
        const message = `📰 *NOVA PUBLICAÇÃO QWEI*

*Título:* ${source_title}

*Preview Instagram:*
${caption_instagram?.substring(0, 300)}${caption_instagram?.length > 300 ? "..." : ""}

Escolha uma opção:`;

        // Send WhatsApp message with approval buttons
        await sendWhatsAppWithButtons({
            phone: adminPhone,
            message,
            imageUrl: image_url,
            buttons: [
                { id: `approve_${postId}`, text: "✅ Aprovar" },
                { id: `regenerate_${postId}`, text: "🔄 Regerar" },
            ],
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: "Notification sent to admin",
                postId,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Wazapi Notifier error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
