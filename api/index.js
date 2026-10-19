import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// App config
// ---------------------------------------------------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// app.use(express.static(path.join(__dirname, "../public")));

// ---------------------------------------------------------------------------
// Simple in-memory cache (per month/day, 1 hour TTL)
// Avoids hammering the Wikipedia API for repeated birthdays.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // key: "MM/DD" -> { data, expires }

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Wikipedia "On this day" fetch
// ---------------------------------------------------------------------------
const getWikiData = async (month, day) => {
  const key = `${month}/${day}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`;

  try {
    const response = await fetch(url, {
      headers: {
        // Wikimedia asks for a descriptive User-Agent; helps avoid 403s.
        "User-Agent": "DayInHistory/1.0 (https://daystory-mu.vercel.app)",
        Accept: "application/json",
      },
      // Abort slow requests so the page doesn't hang.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    setCached(key, data);
    return data;
  } catch (error) {
    console.error(`Error fetching Wikipedia data for ${key}:`, error.message);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Ensures the arrays the template loops over always exist,
// even if the API omits a section.
function normalizeData(data) {
  return {
    events: data.events || [],
    births: data.births || [],
    deaths: data.deaths || [],
    holidays: data.holidays || [],
  };
}

// Parses "YYYY-MM-DD" (what <input type="date"> sends) safely in UTC
// so the month/day can't shift by a timezone offset.
function parseDateInput(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  // Reject impossible dates like 2023-02-31
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.render("index", { data: null, dob: null });
});

app.post("/getData", (req, res) => {
  const { date } = req.body;

  if (!date || !parseDateInput(date)) {
    return res.redirect("/");
  }

  res.redirect(`/getData/show?date=${encodeURIComponent(date)}`);
});

app.get("/getData/show", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).send("Please select a date.");
    }

    const selectedDate = parseDateInput(date);
    if (!selectedDate) {
      return res.status(400).send("Invalid date.");
    }

    const month = String(selectedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getUTCDate()).padStart(2, "0");

    const rawData = await getWikiData(month, day);
    if (!rawData) {
      return res.status(502).send("Unable to fetch historical data. Please try again.");
    }

    res.render("index", {
      data: normalizeData(rawData),
      dob: selectedDate.toDateString(),
    });
  } catch (error) {
    console.error("Error in /getData/show:", error);
    res.status(500).send("Something went wrong.");
  }
});

// 404 fallback (optional but nice)
app.use((req, res) => {
  res.status(404).send("Page not found.");
});

export default app;