export default function TasksPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Tasks & Deadlines</h1>
        <p className="text-gray-400 mb-8">
          Manage founder responsibilities and project commitments.
        </p>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create Task</h2>

          <div className="grid gap-4">
            <input
              type="text"
              placeholder="Task title"
              className="w-full rounded-xl bg-black border border-gray-700 px-4 py-3"
            />
            <textarea
              placeholder="Task description"
              className="w-full rounded-xl bg-black border border-gray-700 px-4 py-3"
              rows={4}
            />
            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Owner"
                className="rounded-xl bg-black border border-gray-700 px-4 py-3"
              />
              <input
                type="date"
                className="rounded-xl bg-black border border-gray-700 px-4 py-3"
              />
              <select className="rounded-xl bg-black border border-gray-700 px-4 py-3">
                <option>Todo</option>
                <option>In Progress</option>
                <option>Blocked</option>
                <option>Done</option>
              </select>
            </div>

            <button className="rounded-xl bg-white text-black font-semibold px-5 py-3 w-fit">
              Add Task
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}