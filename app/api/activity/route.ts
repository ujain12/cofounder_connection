import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    let query = supabase
      .from("workspace_activity")
      .select("*")
      .order("created_at", { ascending: false });

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/activity supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activity: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/activity unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const body = await request.json();

    const workspaceId = body.workspaceId;
    const userId = body.userId ?? null;
    const activityType = body.activityType;
    const activityNote = body.activityNote ?? "";

    if (!workspaceId || !activityType) {
      return NextResponse.json(
        {
          success: false,
          error: "workspaceId and activityType are required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("workspace_activity")
      .insert([
        {
          workspace_id: workspaceId,
          user_id: userId,
          activity_type: activityType,
          activity_note: activityNote,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("POST /api/activity supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activity: data,
    });
  } catch (error) {
    console.error("POST /api/activity unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log activity" },
      { status: 500 }
    );
  }
}