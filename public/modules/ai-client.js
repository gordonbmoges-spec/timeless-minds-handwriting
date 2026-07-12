export async function requestPersonaReply(payload) {
  const response = await fetch("/api/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "人物档案暂时没有回应。");
    error.code = data.error || "request_failed";
    error.status = response.status;
    throw error;
  }
  return data;
}
