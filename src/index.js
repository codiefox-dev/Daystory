import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set("view engine", "ejs");


app.set("views", path.join(__dirname, "./views"));

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
// app.use(express.static(path.join(__dirname, "../public")));



const getWikiData = async (month, day) => {
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error fetching Wikipedia data:", error);
    return null;
  }
};



app.get("/", (req, res) => {
  res.render("index", {
    data: null,
    dob: null,
  });
});

app.post("/getData", (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.redirect("/");
  }

  res.redirect(`/getData/show?date=${encodeURIComponent(date)}`);
});

app.get("/getData/show", async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.send("Please select DOB");
    }

    const selectedDate = new Date(date);

    if (isNaN(selectedDate.getTime())) {
      return res.send("Invalid date");
    }

    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");

    const data = await getWikiData(month, day);

    if (!data) {
      return res.send("Unable to fetch data");
    }

    res.render("index", {
      data: data,
      dob: selectedDate.toDateString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});



export default app;