import express from "express";
const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.render("index", { data: null });
});

const getWikiData = async (month, day) => {
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    return data;

    // You can loop and display this on your webpage
  } catch (err) {
    console.error("Error fetching data", err);
    return null;
  }
};

app.post("/getData", (req, res) => {
  const { date } = req.body;

  res.redirect(`/getData/show?date=${date}`);
});

app.get("/getData/show", async (req, res) => {
  console.log(req.query);
  const d = req.query.date;
  if (!d) {
    return res.send("Please Select DOB");
  }
  let date = new Date(d);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const data = await getWikiData(month, day);

  if (!data) {
    return res.send(" unable to fetch data");
  }

  res.render("index", { data: data, dob: date.toDateString() });
});

app.listen(9000, () => {
  console.log(` server is running on 9000`);
});
