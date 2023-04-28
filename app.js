/**
 * ChatGPT Prompt: 
 * You are an expert web developer. Your goal is to create an Expressjs app that has a a GET route called `schedule`, which responds with a schedule scraped from a webpage. 
 * Code the app.js file.
 * 
 */

const express = require('express');

const app = express();
const aar = require('./access-a-ride');
app.get("/", (req, res) => {
    res.contentType('text/html');
    res.status(200).send("<a href='/schedule'>Schedule</a>");
});

app.get('/schedule', async (req, res) => {
  try {
    const schedule = await aar.getSchedule();
    console.log("\nSchedule:\n", schedule);
    res.contentType('text/html');
    res.status(200).send("<html>"+schedule+"</html>");
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error : '+error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
