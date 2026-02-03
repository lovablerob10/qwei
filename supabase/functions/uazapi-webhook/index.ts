import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const UA_API_ENDPOINT = "/send/text";

Deno.serve(async (req: Request) => {
    try {
        const payload = await req.json();
        console.log("DEBUG: Webhook Payload Total:", JSON.stringify(payload));

        const messageObj = payload.message || {};
        const messageText = (messageObj.text || messageObj.content || payload.text || "").toString().trim();
        const rawSender = messageObj.sender || payload.sender || payload.from || "";
        const senderPhone = rawSender.split('@')[0];
        const ownerPhone = payload.owner || "";

        if (!messageText || !senderPhone) {
            return new Response(JSON.stringify({ success: true, message: "No text or sender" }), { headers: { "Content-Type": "application/json" } });
        }

        const cmd = messageText.toLowerCase();

        // 1. Localizar Instância pelo número que recebeu a mensagem
        const { data: instance, error: instError } = await supabase
            .from('whatsapp_instances')
            .select('user_id, instance_token, server_url')
            .ilike('phone_connected', `%${ownerPhone}%`)
            .limit(1)
            .maybeSingle();

        if (instError || !instance) {
            console.error("DEBUG: Instância não encontrada para o owner:", ownerPhone);
            return new Response("Instance not found", { status: 200 });
        }

        const { user_id, instance_token: token, server_url: serverUrl } = instance;

        const sendReply = async (text: string) => {
            console.log(`DEBUG: Enviando resposta: ${text.substring(0, 50)}...`);
            try {
                const res = await fetch(`${serverUrl}${UA_API_ENDPOINT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'token': token },
                    body: JSON.stringify({ number: senderPhone, text: text })
                });
                const data = await res.json();
                console.log("DEBUG: Uazapi response:", JSON.stringify(data));
            } catch (e) {
                console.error("DEBUG: Erro ao chamar Uazapi:", e);
            }
        };

        // PROCESSAMENTO DE COMANDOS
        console.log(`DEBUG: Processando comando: [${cmd}]`);

        if (cmd.includes('ajuda') || cmd.includes('help') || cmd === '?') {
            await sendReply("🤖 *Assistente QWEI*\n\n1️⃣ *Aprovar* - Publicar a notícia\n2️⃣ *Ver* - Ver resumo da notícia\n3️⃣ *Nichos* - Seus temas monitorados\n4️⃣ *Editar* - Pedir mudanças\n\n*Clique no número ou escreva o comando.*");
        }

        else if (cmd === 'ver' || cmd === '2' || cmd === 'noticia') {
            console.log("DEBUG: Buscando notícia para o usuário:", user_id);
            const { data: news, error: newsError } = await supabase
                .from('curated_news')
                .select('*')
                .eq('user_id', user_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (newsError) {
                console.error("DEBUG: Erro no banco ao buscar notícia:", newsError);
                await sendReply("⚠️ Desculpe, tive um problema técnico ao acessar o banco de dados.");
            } else if (news && news.length > 0) {
                const item = news[0];
                await sendReply(`📰 *NOTÍCIA PENDENTE*\n\n*${item.title}*\n\n${item.summary}\n\n---\n*Comando:* Digite *1* para Aprovar.`);
            } else {
                await sendReply("📭 Não encontrei nenhuma notícia pendente para você neste momento.");
            }
        }

        else if (cmd === 'aprovar' || cmd === '1') {
            const { data: news } = await supabase
                .from('curated_news')
                .select('id, title')
                .eq('user_id', user_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (news) {
                await supabase.from('curated_news').update({ status: 'approved' }).eq('id', news.id);
                await sendReply(`✅ Notícia aprovada: *${news.title}*\nO designer vai começar a trabalhar agora!`);
            } else {
                await sendReply("Não há nada pendente para aprovar. Digite *2* para verificar.");
            }
        }

        else if (cmd === 'nichos' || cmd === '3' || cmd === 'todos') {
            const { data: niches } = await supabase.from('user_niches').select('name').eq('user_id', user_id).eq('active', true);
            const list = niches?.map((n, i) => `🔹 ${n.name}`).join('\n') || "Nenhum nicho ativo.";
            await sendReply(`📂 *Seus Nichos Ativos:*\n\n${list}`);
        }

        else if (cmd === 'editar' || cmd === '4') {
            await sendReply("📝 *O que mudamos?*\nEnvie em áudio ou texto as alterações que deseja na notícia.");
        }

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("WEBHOOK FATAL ERROR:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 200 });
    }
});
