import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PostStatus =
    | "scraping"
    | "editing"
    | "designing"
    | "pending_approval"
    | "approved"
    | "published"
    | "failed";

export interface Post {
    id: string;
    source_title: string | null;
    source_link: string | null;
    content_raw: string | null;
    caption_instagram: string | null;
    copy_linkedin: string | null;
    image_url: string | null;
    image_prompt: string | null;
    status: PostStatus;
    created_at: string;
    published_at: string | null;
}

export interface Credential {
    id: string;
    provider: string;
    token: string | null;
    refresh_token: string | null;
    account_id: string | null;
    updated_at: string;
}

export interface WhatsAppInstance {
    id: string;
    user_id: string;
    server_url: string;
    instance_token: string;
    status: 'pending' | 'qr_ready' | 'connected' | 'disconnected';
    qr_code: string | null;
    phone_connected: string | null;
    webhook_configured: boolean;
    created_at: string;
}

export interface AgentProfile {
    id: string;
    user_id: string;
    niche: string | null;
    voice_tone: string;
    brand_name: string | null;
    target_audience: string | null;
    created_at: string;
}
