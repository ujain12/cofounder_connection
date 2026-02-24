import { supabaseServer } from "@/lib/supabase-server";

export type ToolName =
  | "get_my_profile"
  | "get_other_profile"
  | "get_recent_messages";

export type ToolResult = {
  ok: boolean;
  data?: any;
  error?: string;
  meta?: any;
};

export type ToolDef = {
  name: ToolName;
  description: string;
  parameters: Record<string, any>;
  run: (args: any) => Promise<ToolResult>;
};

// ✅ Only columns that exist (based on your appContext selects)
const SAFE_PROFILE_SELECT =
  "id,full_name,bio,timezone,hours_per_week,stage,goals";

const BLOCKED = ["skills", "availability", "user_id"];

function normalizeSelect(select?: any) {
  if (!select || typeof select !== "string") return SAFE_PROFILE_SELECT;
  for (const b of BLOCKED) if (select.includes(b)) return SAFE_PROFILE_SELECT;
  return select;
}

async function requireUserId() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data?.user?.id) throw new Error("No authenticated user.");
  return data.user.id;
}

async function fetchProfileById(profileId: string, select: string) {
  const supabase = await supabaseServer();

  // ✅ IMPORTANT: profiles key is "id", NOT "user_id"
  const { data, error } = await supabase
    .from("profiles")
    .select(select)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// ✅ Milestone 5: retry + fallback
async function fetchProfileWithFallback(profileId: string, requestedSelect?: any) {
  const requested = normalizeSelect(requestedSelect);

  const attempts = [
    requested,
    SAFE_PROFILE_SELECT,
    "id,full_name,bio,stage,goals",
    "id,full_name,bio",
  ];

  let lastErr: any = null;

  for (const sel of attempts) {
    try {
      const data = await fetchProfileById(profileId, sel);
      return { ok: true, data, meta: { select_used: sel, attempts } };
    } catch (e: any) {
      lastErr = e;
    }
  }

  return {
    ok: false,
    error: lastErr?.message ?? "Failed to fetch profile",
    meta: { attempts },
  };
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_my_profile",
    description:
      "Fetch the logged-in user's founder profile from Supabase (profiles table).",
    parameters: {
      type: "object",
      properties: {
        select: {
          type: "string",
          description:
            "Supabase select string. Valid columns: id, full_name, bio, timezone, hours_per_week, stage, goals.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    run: async (args) => {
      try {
        const userId = await requireUserId();
        return await fetchProfileWithFallback(userId, args?.select);
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
      }
    },
  },

  {
    name: "get_other_profile",
    description:
      "Fetch another user's profile by their auth userId (matches profiles.id).",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Target user's auth userId" },
        select: {
          type: "string",
          description:
            "Supabase select string. Valid columns: id, full_name, bio, timezone, hours_per_week, stage, goals.",
        },
      },
      required: ["userId"],
      additionalProperties: false,
    },
    run: async (args) => {
      try {
        const userId = String(args?.userId ?? "").trim();
        if (!userId) return { ok: false, error: "userId is required." };
        return await fetchProfileWithFallback(userId, args?.select);
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
      }
    },
  },

  {
    name: "get_recent_messages",
    description:
      "Fetch recent messages by chatId for coach/chatbot context.",
    parameters: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Chat/thread id" },
        limit: {
          type: "integer",
          description: "How many recent messages (1-50). Default 15.",
          default: 15,
        },
      },
      required: ["chatId"],
      additionalProperties: false,
    },
    run: async (args) => {
      try {
        const supabase = await supabaseServer();
        const chatId = String(args?.chatId ?? "").trim();
        if (!chatId) return { ok: false, error: "chatId is required." };

        const limitRaw = Number(args?.limit ?? 15);
        const limit = Math.min(Math.max(limitRaw, 1), 50);

        // If your columns differ, change them here to match your DB
        const { data, error } = await supabase
          .from("messages")
          .select("id,chat_id,sender_id,body,created_at")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw new Error(error.message);
        return { ok: true, data: [...(data ?? [])].reverse(), meta: { limit } };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
      }
    },
  },
];