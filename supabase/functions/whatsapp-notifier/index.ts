import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const uazapiUrl = Deno.env.get("UAZAPI_SERVER_URL")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CuratedNews {
    id: string;
    niche_id: string;
    original_title: string;
    authority_text: string;
    user_niches: {
        name: string;
    };
}

// Generate grouped summary message
function generateDailySummary(news: CuratedNews[]): string {
    // Group by niche
    const nicheGroups = new Map<string, CuratedNews[]>();

    news.forEach(n => {
        const nicheName = n.user_niches?.name || 'Geral';
        const existing = nicheGroups.get(nicheName) || [];
        existing.push(n);
        nicheGroups.set(nicheName, existing);
    });

    let message = "🤖 *QWEI - Resumo do Dia*\n\n";
    message += `Encontrei oportunidades em ${nicheGroups.size} nicho(s):\n\n`;

    let index = 1;

    for (const [nicheName, nicheNews] of nicheGroups) {
        message += `*${index}️⃣ ${nicheName}*\n`;
        nicheNews.slice(0, 2).forEach((n) => {
            const title = n.original_title.length > 50
                ? n.original_title.substring(0, 50) + '...'
                : n.original_title;
            message += `   • ${title}\n`;
        });
        message += "\n";
        index++;
    }

    message += "────────────────\n";
    message += "Qual nicho revisar? Responda *1*, *2*, etc.\n";
    message += "Ou *todos* para ver tudo.";

    return message;
}

// Send message via Uazapi
async function sendWhatsAppMessage(
    instanceToken: string,
    phone: string,
    message: string
): Promise<boolean> {
    try {
        const response = await fetch(`${uazapiUrl}/message/sendText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${instanceToken}`,
            },
            body: JSON.stringify({
                phone: phone.replace(/\D/g, ''),
                message,
            }),
        });

        if (!response.ok) {
            console.error(`Uazapi send error: ${response.status}`);
            return false;
        }

        const data = await response.json();
        console.log('Message sent:', data.key?.id);
        return true;
    } catch (error) {
        console.error('WhatsApp send error:', error);
        return false;
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { user_id } = await req.json().catch(() => ({}));

        // BATCH MODE: Process all users
        if (!user_id) {
            const { data: pendingNews } = await supabase
                .from('curated_news')
                .select(`
          id, user_id, niche_id, original_title, authority_text,
          user_niches ( name )
        `)
                .eq('status', 'pending')
                .eq('sent_to_whatsapp', false)
                .order('user_id, niche_id');

            if (!pendingNews || pendingNews.length === 0) {
                return new Response(
                    JSON.stringify({ success: true, message: 'No pending news to send' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Group by user
            const userNewsMap = new Map<string, CuratedNews[]>();
            pendingNews.forEach(n => {
                const existing = userNewsMap.get(n.user_id) || [];
                existing.push(n as unknown as CuratedNews);
                userNewsMap.set(n.user_id, existing);
            });

            let sentCount = 0;

            for (const [userId, userNews] of userNewsMap) {
                // Get user's WhatsApp instance
                const { data: instance } = await supabase
                    .from('whatsapp_instances')
                    .select('instance_token, owner_phone')
                    .eq('user_id', userId)
                    .eq('status', 'connected')
                    .single();

                if (!instance?.instance_token || !instance?.owner_phone) {
                    console.log(`No WhatsApp for user ${userId}`);
                    continue;
                }

                const summaryMessage = generateDailySummary(userNews);
                const sent = await sendWhatsAppMessage(
                    instance.instance_token,
                    instance.owner_phone,
                    summaryMessage
                );

                if (sent) {
                    // Mark as sent
                    const newsIds = userNews.map(n => n.id);
                    await supabase
                        .from('curated_news')
                        .update({ sent_to_whatsapp: true })
                        .in('id', newsIds);

                    sentCount++;
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    mode: 'batch',
                    users_notified: sentCount,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // SINGLE USER MODE
        const { data: pendingNews } = await supabase
            .from('curated_news')
            .select(`
        id, niche_id, original_title, authority_text,
        user_niches ( name )
      `)
            .eq('user_id', user_id)
            .eq('status', 'pending')
            .eq('sent_to_whatsapp', false);

        if (!pendingNews || pendingNews.length === 0) {
            return new Response(
                JSON.stringify({ success: false, message: 'No pending news' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, owner_phone')
            .eq('user_id', user_id)
            .eq('status', 'connected')
            .single();

        if (!instance?.instance_token || !instance?.owner_phone) {
            return new Response(
                JSON.stringify({ success: false, message: 'WhatsApp not connected' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const summaryMessage = generateDailySummary(pendingNews as unknown as CuratedNews[]);
        const sent = await sendWhatsAppMessage(
            instance.instance_token,
            instance.owner_phone,
            summaryMessage
        );

        if (sent) {
            const newsIds = pendingNews.map(n => n.id);
            await supabase
                .from('curated_news')
                .update({ sent_to_whatsapp: true })
                .in('id', newsIds);
        }

        return new Response(
            JSON.stringify({
                success: sent,
                message: sent ? 'Summary sent to WhatsApp' : 'Failed to send',
                news_count: pendingNews.length,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('WhatsApp notifier error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
