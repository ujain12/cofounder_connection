import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "AI summarize route is not available yet.",
    },
    { status: 501 }
  );
}