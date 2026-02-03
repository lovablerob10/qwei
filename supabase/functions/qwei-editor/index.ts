import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const QWEI_SYSTEM_PROMPT = `Você é o QWEI Editor, um redator de elite especializado em conteúdo de tecnologia.

ESTILO DE VOZ QWEI:
- Direta e objetiva, sem rodeios
- Profissional mas acessível
- Sem clichês ou jargões batidos
- Minimalista - cada palavra conta
- Tom confiante mas não arrogante

REGRAS:
1. Nunca use "revolucionário", "disruptivo", "game-changer"
2. Evite emojis em excesso (máximo 2 por post)
3. Foque no impacto real da notícia
4. Mantenha a autenticidade`;

async function generateCaptions(contentRaw: string): Promise<{ instagram: string; linkedin: string }> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: QWEI_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Baseado nesta notícia, gere:

1. CAPTION INSTAGRAM (máx 2200 chars): Hook forte, conteúdo relevante, CTA sutil
2. COPY LINKEDIN (máx 3000 chars): Tom mais profissional, insights de mercado

NOTÍCIA:
${contentRaw}

Responda em JSON:
{"instagram": "...", "linkedin": "..."}`,
                },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
}

Deno.serve(async (req: Request) => {
    try {
        const { record } = await req.json();
        const postId = record.id;
        const contentRaw = record.content_raw;

        if (!contentRaw) {
            return new Response(
                JSON.stringify({ success: false, error: "No content_raw provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Generate captions using OpenAI
        const captions = await generateCaptions(contentRaw);

        // Update the post with generated captions
        const { error } = await supabase
            .from("posts")
            .update({
                caption_instagram: captions.instagram,
                copy_linkedin: captions.linkedin,
                status: "designing",
            })
            .eq("id", postId);

        if (error) {
            throw new Error(`Database update error: ${error.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Captions generated successfully",
                postId,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("QWEI Editor error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
