import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const UA_API_ENDPOINT = "/send/text";

Deno.serve(async (req: Request) => {
    try {
        const payload = await req.json();
        console.log("Uazapi Webhook received:", JSON.stringify(payload, null, 2));

        // 1. Anti-loop: Ignore messages sent by the bot itself
        if (payload.fromMe === true || payload.isStatus === true) {
            return new Response(JSON.stringify({ success: true, message: "Ignored self/status message" }), { headers: { "Content-Type": "application/json" } });
        }

        const messageText = payload.text?.message || payload.body || "";
        const senderPhone = payload.from || payload.sender || payload.key?.remoteJid?.split('@')[0];
        const instanceToken = payload.instanceToken || req.headers.get("token"); // Uazapi sometimes sends token in body or header

        // Fallback: If no token in payload, we might need to find it by instance_name if provided
        // For now, we assume the webhook URL might have the instance_id if we want to be safe,
        // but Uazapi usually sends enough info.

        if (!messageText || !senderPhone) {
            return new Response(JSON.stringify({ success: false, error: "Missing message or sender" }), { headers: { "Content-Type": "application/json" } });
        }

        const cmd = messageText.trim().toLowerCase();

        // 2. Logic to handle commands
        // - "aprovar" or "1" -> Approve news
        // - "editar" or "2" -> Edit news
        // - "todos" -> Show all niches
        // - "ajuda" -> Show help

        // We need to find which user this phone belongs to
        const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('user_id, instance_token, server_url')
            .ilike('phone_connected', `%${senderPhone}%`)
            .single();

        if (!instance) {
            console.log("No instance found for phone:", senderPhone);
            return new Response(JSON.stringify({ success: false, error: "User not found" }), { status: 200 });
        }

        const { user_id, instance_token: token, server_url: serverUrl } = instance;

        // Helper to send reply
        const sendReply = async (text: string) => {
            await fetch(`${serverUrl}${UA_API_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': token
                },
                body: JSON.stringify({
                    number: senderPhone,
                    text: text
                })
            });
        };

        if (cmd === 'ajuda' || cmd === 'help' || cmd === '?') {
            await sendReply("🤖 *QWEI Assistente*\n\nComandos disponíveis:\n1️⃣ *Aprovar* - Aprova a última notícia\n2️⃣ *Editar* - Solicita edição\n3️⃣ *Todos* - Ver todos os seus nichos\n💡 Ou digite o número do nicho para ver notícias dele.");
        } else if (cmd === 'aprovar' || cmd === '1') {
            // Logic to approve latest pending news for this user
            const { data: news } = await supabase
                .from('curated_news')
                .select('*')
                .eq('user_id', user_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (news) {
                await supabase.from('curated_news').update({ status: 'approved' }).eq('id', news.id);
                await sendReply("✅ Notícia aprovada! Vou preparar a postagem.");
            } else {
                await sendReply("Não encontrei notícias pendentes para aprovar.");
            }
        } else if (cmd === 'editar' || cmd === '2') {
            await sendReply("📝 Me diga o que você gostaria de mudar na notícia?");
        } else if (cmd === 'todos' || cmd === '3') {
            const { data: niches } = await supabase.from('user_niches').select('name').eq('user_id', user_id).eq('active', true);
            const list = niches?.map((n, i) => `${i + 1}. ${n.name}`).join('\n') || "Nenhum nicho ativo.";
            await sendReply(`📂 *Seus Nichos:*\n\n${list}`);
        }

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Webhook Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
});
