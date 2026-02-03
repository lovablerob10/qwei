import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN")!;
const serverUrl = "https://corretor20.uazapi.com"; // Default server or from env

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    try {
        // -------------------------------------------------------------------------
        // CONNECT: Create new instance and setup webhook
        // -------------------------------------------------------------------------
        if (path === 'connect') {
            const { user_id } = await req.json();

            if (!user_id) throw new Error("user_id is required");

            // 1. Check if user already has a connecting or connected instance
            const { data: existing } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('user_id', user_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (existing && existing.status === 'connected') {
                return new Response(JSON.stringify({
                    success: true,
                    status: 'already_connected',
                    phone: existing.phone_connected,
                    instance_id: existing.id
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // 2. Create Instance in Uazapi
            const instanceName = `qwei_${user_id.substring(0, 8)}_${Date.now()}`;

            const createRes = await fetch(`${serverUrl}/instance/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'admintoken': adminToken
                },
                body: JSON.stringify({ instanceName })
            });

            const createData = await createRes.json();
            if (!createRes.ok) throw new Error(`Uazapi create error: ${JSON.stringify(createData)}`);

            const instanceToken = createData.instance?.token || createData.token;

            // 3. Configure Webhook Automatically
            const webhookUrl = `${supabaseUrl}/functions/v1/uazapi-webhook`;

            await fetch(`${serverUrl}/instance/setWebhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instanceToken
                },
                body: JSON.stringify({
                    url: webhookUrl,
                    enabled: true,
                    events: ["messages"],
                    excludeEvents: ["wasSentByApi"]
                })
            });

            // 4. Save to Database
            const { data: newInstance, error: dbError } = await supabase
                .from('whatsapp_instances')
                .insert({
                    user_id,
                    instance_name: instanceName,
                    instance_token: instanceToken,
                    server_url: serverUrl,
                    status: 'connecting'
                })
                .select()
                .single();

            if (dbError) throw dbError;

            // 5. Get initial QR Code
            const qrRes = await fetch(`${serverUrl}/instance/qrCode`, {
                method: 'GET',
                headers: { 'token': instanceToken }
            });
            const qrData = await qrRes.json();

            return new Response(JSON.stringify({
                success: true,
                instance_id: newInstance.id,
                qr_code: qrData.base64 || qrData.qrcode || null
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // -------------------------------------------------------------------------
        // STATUS: Check connection status
        // -------------------------------------------------------------------------
        if (path === 'status') {
            const instanceId = url.searchParams.get('instance_id');
            if (!instanceId) throw new Error("instance_id is required");

            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single();

            if (!inst) throw new Error("Instance not found");

            const res = await fetch(`${inst.server_url}/instance/status`, {
                method: 'GET',
                headers: { 'token': inst.instance_token }
            });
            const data = await res.json();

            const isConnected = data.status === 'connected' || data.instanceStatus === 'connected';

            if (isConnected) {
                const phone = data.number || data.phone || data.connectedPhone || "WhatsApp";
                await supabase
                    .from('whatsapp_instances')
                    .update({ status: 'connected', phone_connected: phone })
                    .eq('id', instanceId);

                return new Response(JSON.stringify({ status: 'connected', phone }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ status: 'connecting' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // -------------------------------------------------------------------------
        // QR-CODE: Fetch latest QR
        // -------------------------------------------------------------------------
        if (path === 'qr-code') {
            const instanceId = url.searchParams.get('instance_id');
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single();

            const res = await fetch(`${inst.server_url}/instance/qrCode`, {
                method: 'GET',
                headers: { 'token': inst.instance_token }
            });
            const data = await res.json();

            return new Response(JSON.stringify({ qr_code: data.base64 || data.qrcode || null }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // -------------------------------------------------------------------------
        // CANCEL/DELETE: Remove instance
        // -------------------------------------------------------------------------
        if (path === 'cancel') {
            const instanceId = url.searchParams.get('instance_id');
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .single();

            if (inst) {
                // Delete from Uazapi
                await fetch(`${inst.server_url}/instance/delete`, {
                    method: 'DELETE',
                    headers: { 'admintoken': adminToken, 'token': inst.instance_token }
                });

                // Delete from DB
                await supabase.from('whatsapp_instances').delete().eq('id', instanceId);
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error("Invalid endpoint");

    } catch (error: any) {
        console.error(`Error in instance-manager:`, error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
