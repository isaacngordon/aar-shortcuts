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

let cachedSchedule = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

app.get("/", (req, res) => {
    res.contentType('text/html');
    res.status(200).send("<a href='/schedule'>Schedule</a>");
});

app.get('/schedule', async (req, res) => {
  const currentTime = Date.now();

  if (cachedSchedule && (currentTime - lastFetchTime < CACHE_DURATION)) {
    console.log("Serving cached schedule");
    res.contentType('text/html');
    return res.status(200).send("<html>"+cachedSchedule+"</html>");
  }

  try {
    const schedule = await aar.getSchedule();
    cachedSchedule = schedule;
    lastFetchTime = currentTime;
    console.log("\nSchedule:\n", schedule);
    res.contentType('text/html');
    let sched_html = schedule !== undefined ? schedule : "<p>No schedule found</p>";
    res.status(200).send("<html>"+sched_html+"</html>");
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error: Schedule not available');
  }
});

app.use('/yogo', yogoRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});