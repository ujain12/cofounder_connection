import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Member = {
  user_id: string;
  full_name?: string | null;
};

type Checkin = {
  founder_id: string;
  accomplishments: string | null;
  blockers: string | null;
  next_priorities: string | null;
  submitted_at: string;
};

type Activity = {
  user_id: string | null;
  activity_type: string;
  activity_note: string | null;
  created_at: string;
};

function buildFounderSummary(member: Member, checkins: Checkin[], activity: Activity[]) {
  const name = member.full_name || "Unknown Founder";
  const founderCheckins = checkins.filter((c) => c.founder_id === member.user_id);
  const founderActivity = activity.filter((a) => a.user_id === member.user_id);

  const accomplishmentsText = founderCheckins
    .map((c) => c.accomplishments)
    .filter(Boolean)
    .join(" | ");

  const blockersText = founderCheckins
    .map((c) => c.blockers)
    .filter(Boolean)
    .join(" | ");

  const prioritiesText = founderCheckins
    .map((c) => c.next_priorities)
    .filter(Boolean)
    .join(" | ");

  const latestCheckin = founderCheckins[0]?.submitted_at || null;
  const latestActivity = founderActivity[0]?.created_at || null;

  return {
    founderId: member.user_id,
    founderName: name,
    totalCheckins: founderCheckins.length,
    totalActivity: founderActivity.length,
    latestCheckin,
    latestActivity,
    responsibilitiesSummary:
      accomplishmentsText || prioritiesText
        ? `${name} has recently focused on: ${[accomplishmentsText, prioritiesText]
            .filter(Boolean)
            .join(" | ")}`
        : `${name} has not added enough check-in detail yet.`,
    blockersSummary: blockersText
      ? `${name}'s blockers: ${blockersText}`
      : `${name} has not reported blockers recently.`,
  };
}

function buildCollaborationSummary(founderSummaries: ReturnType<typeof buildFounderSummary>[]) {
  if (founderSummaries.length === 0) {
    return {
      collaborationHealth: "No founder data available yet.",
      imbalanceInsight: "No activity yet.",
      activityAnalysis: "No recent activity found.",
    };
  }

  if (founderSummaries.length === 1) {
    return {
      collaborationHealth: "Only one founder is currently visible in this workspace.",
      imbalanceInsight: "Cannot compare contribution balance yet.",
      activityAnalysis: `${founderSummaries[0].founderName} has ${founderSummaries[0].totalCheckins} check-ins and ${founderSummaries[0].totalActivity} activity events.`,
    };
  }

  const [a, b] = founderSummaries;
  const scoreA = a.totalCheckins * 3 + a.totalActivity;
  const scoreB = b.totalCheckins * 3 + b.totalActivity;

  let imbalanceInsight = "Effort appears relatively balanced between both founders.";
  if (scoreA >= scoreB + 3) {
    imbalanceInsight = `${a.founderName} appears more active than ${b.founderName} recently. Consider rebalancing responsibilities or checking in on workload.`;
  } else if (scoreB >= scoreA + 3) {
    imbalanceInsight = `${b.founderName} appears more active than ${a.founderName} recently. Consider rebalancing responsibilities or checking in on workload.`;
  }

  let collaborationHealth = "Collaboration looks healthy with visible contributions from both founders.";
  if (a.totalCheckins === 0 || b.totalCheckins === 0) {
    collaborationHealth =
      "One founder has not submitted recent check-ins. Collaboration visibility is incomplete.";
  } else if (Math.abs(scoreA - scoreB) >= 5) {
    collaborationHealth =
      "There may be a contribution imbalance. The team should align on ownership, expectations, and check-in cadence.";
  }

  const activityAnalysis = `${a.founderName}: ${a.totalCheckins} check-ins, ${a.totalActivity} activity events. ${b.founderName}: ${b.totalCheckins} check-ins, ${b.totalActivity} activity events.`;

  return {
    collaborationHealth,
    imbalanceInsight,
    activityAnalysis,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    let workspaceId = searchParams.get("workspaceId");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not authenticated" },
        { status: 401 }
      );
    }

    if (!workspaceId) {
      const { data: myMemberships, error: membershipError } = await supabase
        .from("workspace_members")
        .select("workspace_id, joined_at")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true });

      if (membershipError) {
        return NextResponse.json(
          { success: false, error: membershipError.message },
          { status: 500 }
        );
      }

      if (!myMemberships || myMemberships.length === 0) {
        return NextResponse.json({
          success: true,
          workspaceId: null,
          founderSummaries: [],
          collaborationHealth: "No workspace found for the current user.",
          imbalanceInsight: "No comparison available.",
          activityAnalysis: "No activity found.",
        });
      }

      workspaceId = myMemberships[0].workspace_id;
    }

    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId);

    if (membersError) {
      return NextResponse.json(
        { success: false, error: membersError.message },
        { status: 500 }
      );
    }

    const userIds = Array.from(
      new Set((members ?? []).map((m) => m.user_id).filter(Boolean))
    );

    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [], error: null as any };

    if (profilesError) {
      return NextResponse.json(
        { success: false, error: profilesError.message },
        { status: 500 }
      );
    }

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name])
    );

    const enrichedMembers: Member[] = (members ?? []).map((member) => ({
      user_id: member.user_id,
      full_name: profileMap[member.user_id] ?? "Unknown Founder",
    }));

    const { data: checkins, error: checkinsError } = await supabase
      .from("weekly_checkins")
      .select("founder_id, accomplishments, blockers, next_priorities, submitted_at")
      .eq("workspace_id", workspaceId)
      .order("submitted_at", { ascending: false })
      .limit(20);

    if (checkinsError) {
      return NextResponse.json(
        { success: false, error: checkinsError.message },
        { status: 500 }
      );
    }

    const { data: activity, error: activityError } = await supabase
      .from("workspace_activity")
      .select("user_id, activity_type, activity_note, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (activityError) {
      return NextResponse.json(
        { success: false, error: activityError.message },
        { status: 500 }
      );
    }

    const founderSummaries = enrichedMembers.map((member) =>
      buildFounderSummary(member, checkins ?? [], activity ?? [])
    );

    const collaborationSummary = buildCollaborationSummary(founderSummaries);

    return NextResponse.json({
      success: true,
      workspaceId,
      founderSummaries,
      collaborationHealth: collaborationSummary.collaborationHealth,
      imbalanceInsight: collaborationSummary.imbalanceInsight,
      activityAnalysis: collaborationSummary.activityAnalysis,
    });
  } catch (error) {
    console.error("GET /api/checkins/summary unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate check-in summary" },
      { status: 500 }
    );
  }
}