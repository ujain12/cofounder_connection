import { SupabaseClient } from "@supabase/supabase-js";

export const MODEL_PRICING: Record<string, { input: number; output: number; tier: "cheap" | "mid" | "premium" }> = {
  "gpt-4o-mini":                        { input: 0.00015, output: 0.0006,  tier: "cheap" },
  "gpt-4o":                             { input: 0.0025,  output: 0.01,    tier: "premium" },
  "claude-haiku-4-5-20251001":          { input: 0.0008,  output: 0.004,   tier: "cheap" },
  "claude-sonnet-4-5-20250929":         { input: 0.003,   output: 0.015,   tier: "premium" },
  "google/gemma-2-2b-it":               { input: 0.0001,  output: 0.0001,  tier: "cheap" },
  "mistralai/Mistral-7B-Instruct-v0.3": { input: 0.0001,  output: 0.0001,  tier: "cheap" },
  "openrouter/free":                    { input: 0.0,     output: 0.0,     tier: "cheap" },
};

export const MARGIN = 0.10;

// ── CACHE ──

type CacheEntry = { response: string; model: string; tokens: { input: number; output: number }; timestamp: number; hits: number; };

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function getCacheKey(task: string, payload: string): string {
  return `${task}:${payload.toLowerCase().trim().slice(0, 200)}`;
}

export function checkCache(task: string, payload: string): CacheEntry | null {
  const entry = responseCache.get(getCacheKey(task, payload));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) { responseCache.delete(getCacheKey(task, payload)); return null; }
  entry.hits++;
  return entry;
}

export function setCache(task: string, payload: string, response: string, model: string, tokens: { input: number; output: number }) {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) responseCache.delete(oldest[0]);
  }
  responseCache.set(getCacheKey(task, payload), { response, model, tokens, timestamp: Date.now(), hits: 0 });
}

export function getCacheStats() {
  let totalHits = 0;
  let totalEntries = 0;
  let estimatedSavings = 0;
  responseCache.forEach((entry) => {
    totalEntries++;
    totalHits += entry.hits;
    const pricing = MODEL_PRICING[entry.model] || { input: 0.001, output: 0.002 };
    estimatedSavings += ((entry.tokens.input / 1000) * pricing.input + (entry.tokens.output / 1000) * pricing.output) * entry.hits;
  });
  return { totalEntries, totalHits, estimatedSavings: Math.round(estimatedSavings * 10000) / 10000 };
}

// ── CASCADE CONFIG ──

export type CascadeResult = { response: string; model: string; escalated: boolean; reason: string; attempts: { model: string; passed: boolean; reason: string }[]; tokens: { input: number; output: number }; cost: number; };

const TASK_CASCADE: Record<string, { cheap: string; premium: string; provider_cheap: string; provider_premium: string }> = {
  chatbot:          { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  rewrite_profile:  { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  profile_missing:  { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  match_explain:    { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  opener:           { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  coach:            { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
  tag_extraction:   { cheap: "claude-haiku-4-5-20251001", premium: "gpt-4o-mini",                provider_cheap: "anthropic", provider_premium: "openai" },
  score_match:      { cheap: "claude-haiku-4-5-20251001", premium: "gpt-4o-mini",                provider_cheap: "anthropic", provider_premium: "openai" },
  search_synthesis: { cheap: "gpt-4o-mini",               premium: "claude-sonnet-4-5-20250929", provider_cheap: "openai",    provider_premium: "anthropic" },
  weekly_summary:   { cheap: "gpt-4o-mini",               premium: "gpt-4o",                     provider_cheap: "openai",    provider_premium: "openai" },
};

export function getCascadeConfig(task: string) {
  return TASK_CASCADE[task] || TASK_CASCADE["chatbot"];
}

// ── COST CALCULATION ──

export function calculateRequestCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
  const apiCost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  const margin = apiCost * MARGIN;
  return {
    apiCost: Math.round(apiCost * 1000000) / 1000000,
    margin: Math.round(margin * 1000000) / 1000000,
    totalCharged: Math.round((apiCost + margin) * 1000000) / 1000000,
    model, inputTokens, outputTokens,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── USAGE LOGGING ──

export async function logUsage(supabase: SupabaseClient, userId: string, action: string, model: string, inputTokens: number, outputTokens: number, escalated: boolean = false, cached: boolean = false) {
  const { apiCost, margin, totalCharged } = calculateRequestCost(model, inputTokens, outputTokens);
  await supabase.from("usage_log").insert({ user_id: userId, action, model, tokens_used: inputTokens + outputTokens, cost: apiCost, your_margin: margin, total_charged: cached ? 0 : totalCharged });
  if (!cached && totalCharged > 0) {
    const { data: profile } = await supabase.from("profiles").select("credits_balance").eq("id", userId).maybeSingle();
    const currentBalance = Number(profile?.credits_balance || 0);
    await supabase.from("profiles").update({ credits_balance: Math.max(0, currentBalance - totalCharged) }).eq("id", userId);
  }
  return { apiCost, margin, totalCharged, cached };
}

// ── ANALYTICS ──

export type CostAnalytics = {
  totalUsers: number; totalRequests: number; totalApiCost: number; totalMargin: number; totalRevenue: number;
  avgCostPerRequest: number; avgCostPerUser: number;
  modelBreakdown: { model: string; requests: number; totalCost: number; avgTokens: number }[];
  userBreakdown: { userId: string; name: string; requests: number; totalCost: number; totalCharged: number }[];
  dailyTrend: { date: string; requests: number; cost: number }[];
  cascadeSavings: number;
  cacheStats: { entries: number; hits: number; savings: number };
  projections: { monthlyAt100Users: number; monthlyAt500Users: number; monthlyAt1000Users: number; storageGBPerMonth: number; supabaseCost: number; vercelCost: number; totalMonthlyAt100: number; totalMonthlyAt500: number; totalMonthlyAt1000: number; };
  scalingBottlenecks: string[];
  costPerformanceTradeoffs: { strategy: string; savings: string; tradeoff: string }[];
};

function safe(n: any): number {
  const v = Number(n);
  return isNaN(v) ? 0 : v;
}

export async function generateCostAnalytics(supabase: SupabaseClient): Promise<CostAnalytics> {
  const { data: usageData } = await supabase.from("usage_log").select("*").order("created_at", { ascending: false }).limit(5000);
  const usage = usageData || [];

  const userIds = [...new Set(usage.map(u => u.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds.length > 0 ? userIds : ["none"]);
  const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || "Unknown"]));

  const totalRequests = usage.length;
  const totalApiCost = usage.reduce((sum, u) => sum + safe(u.cost), 0);
  const totalMargin = usage.reduce((sum, u) => sum + safe(u.your_margin), 0);
  const totalRevenue = usage.reduce((sum, u) => sum + safe(u.total_charged), 0);
  const totalUsers = userIds.length;

  // Model breakdown
  const modelMap = new Map<string, { requests: number; totalCost: number; totalTokens: number }>();
  usage.forEach(u => {
    const key = u.model || "unknown";
    const e = modelMap.get(key) || { requests: 0, totalCost: 0, totalTokens: 0 };
    e.requests++; e.totalCost += safe(u.cost); e.totalTokens += safe(u.tokens_used);
    modelMap.set(key, e);
  });
  const modelBreakdown = [...modelMap.entries()].map(([model, d]) => ({ model, requests: d.requests, totalCost: Math.round(d.totalCost * 10000) / 10000, avgTokens: d.requests > 0 ? Math.round(d.totalTokens / d.requests) : 0 })).sort((a, b) => b.requests - a.requests);

  // User breakdown
  const userMap = new Map<string, { requests: number; totalCost: number; totalCharged: number }>();
  usage.forEach(u => {
    const e = userMap.get(u.user_id) || { requests: 0, totalCost: 0, totalCharged: 0 };
    e.requests++; e.totalCost += safe(u.cost); e.totalCharged += safe(u.total_charged);
    userMap.set(u.user_id, e);
  });
  const userBreakdown = [...userMap.entries()].map(([userId, d]) => ({ userId, name: profileMap.get(userId) || "Unknown", requests: d.requests, totalCost: Math.round(d.totalCost * 10000) / 10000, totalCharged: Math.round(d.totalCharged * 10000) / 10000 })).sort((a, b) => b.requests - a.requests);

  // Daily trend
  const dailyMap = new Map<string, { requests: number; cost: number }>();
  usage.forEach(u => {
    const date = new Date(u.created_at).toISOString().slice(0, 10);
    const e = dailyMap.get(date) || { requests: 0, cost: 0 };
    e.requests++; e.cost += safe(u.cost);
    dailyMap.set(date, e);
  });
  const dailyTrend = [...dailyMap.entries()].map(([date, d]) => ({ date, requests: d.requests, cost: Math.round(d.cost * 10000) / 10000 })).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  // Cache
  const cs = getCacheStats();
  const cacheStats = { entries: cs.totalEntries || 0, hits: cs.totalHits || 0, savings: cs.estimatedSavings || 0 };

  // Cascade savings
  const cheapRequests = usage.filter(u => { const p = MODEL_PRICING[u.model]; return p && p.tier === "cheap"; }).length;
  const cascadeSavings = Math.round(cheapRequests * 0.008 * 0.6 * 10000) / 10000;

  // Averages
  const avgCostPerRequest = totalRequests > 0 ? totalApiCost / totalRequests : 0;
  const avgCostPerUser = totalUsers > 0 ? totalApiCost / totalUsers : 0;

  // Projections
  const avgReqPerUser = totalUsers > 0 ? totalRequests / totalUsers : 10;
  const monthlyReqPerUser = avgReqPerUser * 4;
  const project = (users: number) => Math.round(users * monthlyReqPerUser * avgCostPerRequest * 100) / 100;

  const storageGBPerMonth = Math.round((0.5 + totalUsers * 0.01) * 100) / 100;
  const supabaseCost = totalUsers < 50000 ? 0 : 25;
  const vercelCost = totalUsers < 100 ? 0 : 20;

  const projections = {
    monthlyAt100Users: project(100),
    monthlyAt500Users: project(500),
    monthlyAt1000Users: project(1000),
    storageGBPerMonth,
    supabaseCost,
    vercelCost,
    totalMonthlyAt100: project(100) + supabaseCost + vercelCost,
    totalMonthlyAt500: project(500) + 25 + 20,
    totalMonthlyAt1000: project(1000) + 25 + 20,
  };

  // Bottlenecks
  const scalingBottlenecks: string[] = [];
  if (avgCostPerRequest > 0.01) scalingBottlenecks.push("High avg cost per request ($" + safe(avgCostPerRequest).toFixed(4) + ") — consider more aggressive model cascading");
  if (cacheStats.hits < totalRequests * 0.1) scalingBottlenecks.push("Low cache hit rate — many unique queries, consider semantic caching");
  if (modelBreakdown.some(m => m.model.includes("gpt-4o") && !m.model.includes("mini") && m.requests > totalRequests * 0.3)) scalingBottlenecks.push("Over 30% of requests use premium models — tighten cascade quality thresholds");
  if (totalRequests > 0 && cheapRequests / totalRequests < 0.5) scalingBottlenecks.push("Less than 50% of requests use cheap models — cascade not aggressive enough");
  scalingBottlenecks.push("Supabase free tier limits: 500MB database, 1GB storage, 50K monthly active users");
  scalingBottlenecks.push("Vercel free tier: 100GB bandwidth, serverless function 10s timeout for AI calls");

  // Trade-offs
  const cacheSavingsStr = "$" + safe(cacheStats.savings).toFixed(4);
  const marginStr = "$" + safe(totalMargin).toFixed(4);

  const costPerformanceTradeoffs = [
    { strategy: "Model Cascade (FrugalGPT)", savings: "40-60% reduction in API costs", tradeoff: "Slight latency increase on escalated requests (~2x response time when cheap model fails quality check)" },
    { strategy: "Response Caching (15min TTL)", savings: cacheSavingsStr + " saved so far", tradeoff: "Stale responses for up to 15 minutes; not suitable for real-time data queries" },
    { strategy: "Cheap model for extraction tasks", savings: "~80% cheaper than premium for tag extraction and scoring", tradeoff: "Lower creativity and nuance; occasionally misses subtle tags" },
    { strategy: "Premium model only for synthesis", savings: "Used only 1x per search (vs N times for scoring)", tradeoff: "Higher quality final output but single point of failure for recommendation quality" },
    { strategy: "Token limit caps (1200 max)", savings: "Prevents runaway costs on verbose responses", tradeoff: "May truncate complex responses; users may need to re-ask for detail" },
    { strategy: "10% margin on all AI costs", savings: "Revenue: " + marginStr + " earned so far", tradeoff: "Users pay slightly more than raw API cost; competitive pressure if alternatives are cheaper" },
  ];

  return {
    totalUsers,
    totalRequests,
    totalApiCost: Math.round(totalApiCost * 10000) / 10000,
    totalMargin: Math.round(totalMargin * 10000) / 10000,
    totalRevenue: Math.round(totalRevenue * 10000) / 10000,
    avgCostPerRequest: Math.round(avgCostPerRequest * 100000) / 100000,
    avgCostPerUser: Math.round(avgCostPerUser * 10000) / 10000,
    modelBreakdown,
    userBreakdown,
    dailyTrend,
    cascadeSavings,
    cacheStats,
    projections,
    scalingBottlenecks,
    costPerformanceTradeoffs,
  };
}