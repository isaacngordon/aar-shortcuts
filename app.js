/**
 * ChatGPT Prompt: 
 * You are an expert web developer. Your goal is to create an Expressjs app that has a a GET route called `schedule`, which responds with a schedule scraped from a webpage. 
 * Code the app.js file.
 * 
 */

const express = require('express');

const app = express();
const aar = require('./access-a-ride');
const yogoRouter = require('./routers/yogo');

let cachedNextRide = null;
const CACHE_DURATION = 50000;//60 * 60 * 1000; // 1 hour in milliseconds
const CACHE = new Map();

app.get("/", (req, res) => {
  res.contentType('text/html');
  res.status(200).send("<a href='/schedule'>Schedule</a> <a href='/nextRide'>Next Ride</a>");
});

app.get('/nextRide', async (req, res) => {
  const currentTime = Date.now();
  if (CACHE.has("nextRide")) {
    let timeSinceFetch = currentTime - CACHE.get("nextRide").lastFetchedAt;
    console.log("timeSinceFetch:", timeSinceFetch);
    if (timeSinceFetch < CACHE_DURATION) {
      console.log("Serving cached nextRide");
      res.contentType('text/html');
      return res.status(200).send("<html>" + CACHE.get("nextRide").data + "</html>");
    }
  }
  console.log("CACHE miss for nextRide.");

  try {
    res.contentType('text/html');
    const nextRideHtml = await aar.getSchedule();
    if (nextRideHtml !== undefined) {
      CACHE.set("nextRide", { data: nextRideHtml, lastFetchedAt: currentTime });
      console.log("CACHED nextRide HTML.");
      res.status(200).send("<html>" + nextRideHtml + "</html>");
    } else
      res.status(200).send("<p>No schedule found</p>");
  } catch (error) {
    console.error(error);
    res.status(500).send('<p>Internal Server Error: Schedule not available</p>');
  }
});

// app.get('schedule', async (req, res) => {
//   const currentTime = Date.now();

//   if (cachedNextRide && (currentTime - lastNextRideFetchTime < CACHE_DURATION)) {
//     console.log("Serving cached schedule");
//     res.contentType('text/html');
//     return res.status(200).send("<html>" + cachedNextRide + "</html>");
//   }

//   try {
//     const schedule = await aar.getSchedule();
//     cachedNextRide = schedule;
//     lastNextRideFetchTime = currentTime;
//     console.log("\nSchedule:\n", schedule);
//     res.contentType('text/html');
//     let sched_html = schedule !== undefined ? schedule : "<p>No schedule found</p>";
//     res.status(200).send("<html>" + sched_html + "</html>");
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error: Schedule not available');
//   }
// });

app.use('/yogo', yogoRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});