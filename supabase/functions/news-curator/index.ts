import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const tavilyApiKey = Deno.env.get("TAVILY_API_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserNiche {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  tone: string;
  language: string;
}

interface NewsResult {
  title: string;
  url: string;
  content: string;
  source: string;
}

// Fetch news for a niche using Tavily
async function fetchNewsForNiche(niche: UserNiche): Promise<NewsResult[]> {
  try {
    const keywordsQuery = niche.keywords.length > 0
      ? niche.keywords.join(" OR ")
      : niche.name;

    const searchQuery = niche.language === 'pt-BR'
      ? `últimas notícias ${keywordsQuery} Brasil hoje`
      : `latest news ${keywordsQuery} today`;

    console.log(`Searching: ${searchQuery}`);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 3,
        include_answer: false,
        include_images: true,
      }),
    });

    if (!response.ok) {
      console.error(`Tavily error for '${niche.name}': ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.results?.map((item: any) => ({
      title: item.title,
      url: item.url,
      content: item.content || item.snippet,
      source: new URL(item.url).hostname.replace('www.', ''),
    })) || [];
  } catch (error) {
    console.error(`Error fetching news for ${niche.name}:`, error);
    return [];
  }
}

// Rewrite news with authority tone using OpenAI
async function rewriteWithAuthority(
  news: NewsResult,
  niche: UserNiche
): Promise<string> {
  try {
    const toneGuide = {
      profissional: "tom profissional e confiável, como um especialista do setor",
      autoridade: "tom de autoridade absoluta, como o maior expert do mercado",
      informal: "tom amigável e acessível, como um colega de profissão",
      tecnico: "tom técnico e preciso, com dados e análises detalhadas",
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em ${niche.name}. Reescreva notícias com ${toneGuide[niche.tone as keyof typeof toneGuide] || toneGuide.profissional}. 

Regras:
- Máximo 280 caracteres para o texto principal
- Adicione sua análise e opinião de especialista
- Use emojis relevantes
- Não inclua links no texto
- Escreva como se fosse postar no LinkedIn/Instagram`,
          },
          {
            role: "user",
            content: `Notícia: ${news.title}\n\nResumo: ${news.content}\n\nReescreva com autoridade:`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI error: ${response.status}`);
      return `📰 ${news.title}\n\n${news.content.substring(0, 200)}...`;
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || news.title;
  } catch (error) {
    console.error("OpenAI rewrite error:", error);
    return `📰 ${news.title}\n\n${news.content.substring(0, 200)}...`;
  }
}

// Generate grouped WhatsApp summary
function generateDailySummary(
  niches: UserNiche[],
  newsMap: Map<string, { niche: UserNiche; news: Array<{ title: string; authority_text: string }> }>
): string {
  let message = "🤖 *QWEI - Resumo do Dia*\n\n";

  const activeNiches = Array.from(newsMap.values()).filter(n => n.news.length > 0);
  message += `Encontrei oportunidades em ${activeNiches.length} nicho(s):\n\n`;

  let index = 1;
  for (const { niche, news } of activeNiches) {
    message += `*${index}️⃣ ${niche.name}*\n`;
    news.slice(0, 2).forEach((n) => {
      message += `   • ${n.title.substring(0, 50)}...\n`;
    });
    message += "\n";
    index++;
  }

  message += "────────────────\n";
  message += "Qual nicho revisar? Responda *1*, *2*, etc.\n";
  message += "Ou *todos* para ver tudo.";

  return message;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json().catch(() => ({}));

    // BATCH MODE: Process all users with active niches
    if (!user_id) {
      const { data: activeNiches } = await supabase
        .from("user_niches")
        .select("*")
        .eq("active", true)
        .order("user_id, created_at");

      if (!activeNiches || activeNiches.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No active niches", mode: "batch" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Group by user
      const userNichesMap = new Map<string, UserNiche[]>();
      activeNiches.forEach(n => {
        const existing = userNichesMap.get(n.user_id) || [];
        existing.push(n);
        userNichesMap.set(n.user_id, existing);
      });

      let totalProcessed = 0;
      let totalNews = 0;

      for (const [userId, userNiches] of userNichesMap) {
        const newsMap = new Map<string, { niche: UserNiche; news: Array<{ title: string; authority_text: string }> }>();

        for (const niche of userNiches) {
          const newsResults = await fetchNewsForNiche(niche);
          const processedNews: Array<{ title: string; authority_text: string }> = [];

          for (const news of newsResults) {
            const authorityText = await rewriteWithAuthority(news, niche);

            // Save to curated_news
            await supabase.from("curated_news").insert({
              user_id: userId,
              niche_id: niche.id,
              original_title: news.title,
              original_url: news.url,
              original_source: news.source,
              original_summary: news.content,
              authority_text: authorityText,
              status: "pending",
            });

            processedNews.push({ title: news.title, authority_text: authorityText });
            totalNews++;
          }

          newsMap.set(niche.id, { niche, news: processedNews });

          // Update last_search
          await supabase
            .from("user_niches")
            .update({ last_search: new Date().toISOString() })
            .eq("id", niche.id);
        }

        // Generate daily summary for WhatsApp
        if (newsMap.size > 0) {
          const summaryMessage = generateDailySummary(userNiches, newsMap);
          console.log(`Summary for ${userId}: ${summaryMessage.substring(0, 100)}...`);

          // TODO: Send via WhatsApp using whatsapp-notifier
        }

        totalProcessed++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "batch",
          users_processed: totalProcessed,
          news_curated: totalNews,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SINGLE USER MODE
    const { data: niches } = await supabase
      .from("user_niches")
      .select("*")
      .eq("user_id", user_id)
      .eq("active", true)
      .order("created_at");

    if (!niches || niches.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nenhum nicho configurado. Adicione nichos em Configurações.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newsMap = new Map<string, { niche: UserNiche; news: Array<{ title: string; authority_text: string }> }>();
    let curatedCount = 0;

    for (const niche of niches) {
      const newsResults = await fetchNewsForNiche(niche);
      const processedNews: Array<{ title: string; authority_text: string }> = [];

      for (const news of newsResults) {
        const authorityText = await rewriteWithAuthority(news, niche);

        await supabase.from("curated_news").insert({
          user_id,
          niche_id: niche.id,
          original_title: news.title,
          original_url: news.url,
          original_source: news.source,
          original_summary: news.content,
          authority_text: authorityText,
          status: "pending",
        });

        processedNews.push({ title: news.title, authority_text: authorityText });
        curatedCount++;
      }

      newsMap.set(niche.id, { niche, news: processedNews });

      await supabase
        .from("user_niches")
        .update({ last_search: new Date().toISOString() })
        .eq("id", niche.id);
    }

    const summaryMessage = generateDailySummary(niches, newsMap);

    return new Response(
      JSON.stringify({
        success: true,
        mode: "single",
        niches: niches.map(n => n.name),
        news_curated: curatedCount,
        summary: summaryMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("News curator error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
