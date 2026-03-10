"use client";

import { useState } from "react";

export default function MultimodalPage() {
  const [image, setImage] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
      }
    };

    reader.readAsDataURL(file);
  }

  async function handleAsk() {
    if (!image || !question.trim()) {
      alert("Please upload an image and enter a question.");
      return;
    }

    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("/api/multimodal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image,
          question,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnswer(data.error || "Something went wrong.");
      } else {
        setAnswer(data.answer);
      }
    } catch (error) {
      setAnswer("Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Multimodal AI Test</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4"
      />

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about the uploaded image..."
        className="w-full border rounded-lg p-3 min-h-[120px] mb-4 text-black"
      />

      <button
        onClick={handleAsk}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Ask"}
      </button>

      {image && (
        <div className="mt-6">
          <p className="font-semibold mb-2">Preview</p>
          <img
            src={image}
            alt="Uploaded preview"
            className="max-w-full rounded-lg border"
          />
        </div>
      )}

      {answer && (
        <div className="mt-6 border rounded-lg p-4 whitespace-pre-wrap">
          <p className="font-semibold mb-2">Answer</p>
          {answer}
        </div>
      )}
    </main>
  );
}