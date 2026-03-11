export default function CheckinsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Weekly Check-in</h1>
        <p className="text-gray-400 mb-8">
          Keep both founders accountable with structured updates.
        </p>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="grid gap-5">
            <div>
              <label className="block mb-2 font-medium">What did you do this week?</label>
              <textarea
                rows={4}
                className="w-full rounded-xl bg-black border border-gray-700 px-4 py-3"
                placeholder="Write your accomplishments..."
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">What is blocked?</label>
              <textarea
                rows={4}
                className="w-full rounded-xl bg-black border border-gray-700 px-4 py-3"
                placeholder="Write blockers here..."
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Top 3 priorities next week</label>
              <textarea
                rows={4}
                className="w-full rounded-xl bg-black border border-gray-700 px-4 py-3"
                placeholder="List next priorities..."
              />
            </div>

            <button className="rounded-xl bg-white text-black font-semibold px-5 py-3 w-fit">
              Submit Check-in
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}