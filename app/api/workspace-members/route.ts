import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("workspaces")
      .select("id, match_id, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      return NextResponse.json(
        { success: false, error: workspaceError.message },
        { status: 500 }
      );
    }

    if (!workspace) {
      return NextResponse.json({
        success: true,
        workspaceId: null,
        currentUserId: null,
        currentUserName: "No workspace found",
        members: [],
        debug: {
          reason: "No workspaces in database",
        },
      });
    }

    const workspaceId = workspace.id;

    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .select("id, workspace_id, user_id, role, joined_at")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

    if (memberError) {
      return NextResponse.json(
        { success: false, error: memberError.message },
        { status: 500 }
      );
    }

    let members = memberRows || [];

    if (members.length === 0 && workspace.match_id) {
      const { data: matchRow, error: matchError } = await supabaseAdmin
        .from("matches")
        .select("id, user_id, candidate_id")
        .eq("id", workspace.match_id)
        .maybeSingle();

      if (matchError) {
        return NextResponse.json(
          { success: false, error: matchError.message },
          { status: 500 }
        );
      }

      if (matchRow?.user_id) {
        members = [
          {
            id: `inferred-${matchRow.user_id}`,
            workspace_id: workspaceId,
            user_id: matchRow.user_id,
            role: "owner",
            joined_at: new Date().toISOString(),
          },
        ];

        if (matchRow.candidate_id) {
          members.push({
            id: `inferred-${matchRow.candidate_id}`,
            workspace_id: workspaceId,
            user_id: matchRow.candidate_id,
            role: "member",
            joined_at: new Date().toISOString(),
          });
        }
      }
    }

    if (members.length === 0 && workspace.created_by) {
      members = [
        {
          id: `creator-${workspace.created_by}`,
          workspace_id: workspaceId,
          user_id: workspace.created_by,
          role: "owner",
          joined_at: new Date().toISOString(),
        },
      ];
    }

    const userIds = [...new Set(members.map((m: any) => m.user_id).filter(Boolean))];

    let profileMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, bio")
        .in("id", userIds);

      if (profileError) {
        return NextResponse.json(
          { success: false, error: profileError.message },
          { status: 500 }
        );
      }

      profileMap = Object.fromEntries(
        (profiles || []).map((p: any) => [p.id, p])
      );
    }

    const enrichedMembers = members.map((member: any, index: number) => ({
      ...member,
      full_name: profileMap[member.user_id]?.full_name || member.user_id || "Unknown Founder",
      bio: profileMap[member.user_id]?.bio || "",
      is_current_user: index === 0,
    }));

    return NextResponse.json({
      success: true,
      workspaceId,
      currentUserId: enrichedMembers[0]?.user_id || null,
      currentUserName: enrichedMembers[0]?.full_name || "Unknown Founder",
      members: enrichedMembers,
      debug: {
        resolvedFrom:
          memberRows && memberRows.length > 0
            ? "workspace_members"
            : workspace.match_id
            ? "match_fallback"
            : workspace.created_by
            ? "workspace_creator_fallback"
            : "none",
      },
    });
  } catch (error: any) {
    console.error("workspace-members error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch workspace members" },
      { status: 500 }
    );
  }
}