import Link from "next/link";

export default function WorkspacePage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-gray-400">Workspace</p>
          <h1 className="text-4xl font-bold">Founder Project Management</h1>
          <p className="text-gray-300 mt-2">
            Manage agreements, tasks, accountability, and weekly check-ins.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/workspace/agreement"
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 hover:border-gray-600 transition"
          >
            <h2 className="text-xl font-semibold mb-2">Founder Agreement</h2>
            <p className="text-gray-400">
              Define roles, expectations, ownership, and working style.
            </p>
          </Link>

          <Link
            href="/workspace/tasks"
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 hover:border-gray-600 transition"
          >
            <h2 className="text-xl font-semibold mb-2">Tasks & Deadlines</h2>
            <p className="text-gray-400">
              Assign work, track commitments, and manage deadlines.
            </p>
          </Link>

          <Link
            href="/workspace/checkins"
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 hover:border-gray-600 transition"
          >
            <h2 className="text-xl font-semibold mb-2">Weekly Check-ins</h2>
            <p className="text-gray-400">
              Track progress, blockers, and next priorities.
            </p>
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="text-lg font-semibold mb-3">Why this matters</h3>
          <p className="text-gray-400">
            Matching is not enough. This workspace keeps cofounders aligned through
            structure, accountability, and clear communication.
          </p>
        </div>
      </div>
    </main>
  );
}