const PAGE_ID = "100063511842390";
const GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || "v24.0";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(503).json({ error: "Facebook reviews are not configured." });
  }

  const fields = "created_time,recommendation_type,rating,review_text,reviewer{name}";
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PAGE_ID}/ratings`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "6");

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("Facebook reviews request failed", response.status, result.error?.code);
      return res.status(502).json({ error: "Facebook reviews are temporarily unavailable." });
    }

    const reviews = Array.isArray(result.data) ? result.data.map(review => ({
      reviewer: typeof review.reviewer?.name === "string" ? review.reviewer.name : "Facebook user",
      recommendation: review.recommendation_type === "positive" ? "positive"
        : review.recommendation_type === "negative" ? "negative" : null,
      rating: review.rating != null && Number.isFinite(Number(review.rating)) ? Number(review.rating) : null,
      text: typeof review.review_text === "string" ? review.review_text : "",
      createdAt: typeof review.created_time === "string" ? review.created_time : null
    })) : [];

    return res.status(200).json({ reviews });
  } catch (error) {
    console.error("Facebook reviews request failed", error);
    return res.status(502).json({ error: "Facebook reviews are temporarily unavailable." });
  }
};
