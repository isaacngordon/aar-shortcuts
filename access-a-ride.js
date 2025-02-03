const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { sleep } = require('./utils');
dotenv = require('dotenv');
dotenv.config();

const MTA_USERNAME = process.env.MTA_USERNAME ? process.env.MTA_USERNAME : (() => { throw new Error("MTA_USERNAME not set"); })();
const MTA_PASSWORD = process.env.MTA_PASSWORD ? process.env.MTA_PASSWORD : (() => { throw new Error("MTA_PASSWORD not set"); })();
const HEADLESS = process.env.NODE_ENV !== 'development';
console.log("HEADLESS =", HEADLESS, "because the env is: ", process.env.NODE_ENV);

function makeRelativeLinksAbsolute(html) {
    // replace any relative links with absolute links
    return html.replace(/href="\//g, 'href="https://aar.mta.info/');
}

/**
 * Get authentication tokens from MTA website, which is a React application
 */
async function getAuthenticatedChromium() {
    const loginPage = 'https://aar.mta.info/login';
    console.log("Opening and authenticating with AAR in a browser with Headless is set to", HEADLESS);
    const browser = await chromium.launch({ headless: HEADLESS });
    const page = await browser.newPage();

    // Navigate to login page
    await page.goto(loginPage);
    await page.waitForLoadState('domcontentloaded');

    if (!HEADLESS) {
        await page.screenshot({ path: `${process.env.HOME}/Downloads/pre-login.png` });
        console.log("Screenshot saved to: ", `${process.env.HOME}/Downloads/pre-login.png`);
    }

    // Enter username and password and submit
    await page.type(`input[name="username"]`, MTA_USERNAME);
    await page.type(`input[name="password"]`, MTA_PASSWORD);

    // Click the login button, which is a button with type="submit"
    await page.click(`button[type="submit"]`);

    // return the authenticated browser and the page
    if (!HEADLESS) {
        await page.screenshot({ path: `${process.env.HOME}/Downloads/post-login.png` });
        console.log("Screenshot saved to: ", `${process.env.HOME}/Downloads/post-login.png`);
    }
    await page.waitForLoadState('domcontentloaded');
    let pageUrl = page.url();
    console.log("Initial Page URL:", pageUrl);

    // ensure we've navigated to the dashboard page before returning
    let attempt = 1;
    const dashboardPage = 'https://aar.mta.info/trip-booking';
    while (pageUrl !== dashboardPage) {
        await sleep(1000);
        await page.waitForLoadState('domcontentloaded');
        if (HEADLESS) { await page.screenshot({ path: `${process.env.HOME}/Downloads/finally-idle_${attempt}.png` }); }
        pageUrl = page.url();
        console.log(`\t[${attempt++}]Current Page URL:`, pageUrl);
        if (attempt > 10) {
            throw new Error("Unable to get trip booking url");
        }
    }


    return { browser, page };
}


/**
 * Obtain the schedule form the trip-dashboard component. If trip details are available, 
 * obtain and return that instead since it contains more accurate information.
 * 
 * @returns 
 */
async function getNextTripDetailsHtml() {
    const { browser, page } = await getAuthenticatedChromium();

    if (!HEADLESS) {
        await page.screenshot({ path: `${process.env.HOME}/Downloads/pre-cheerio.png` });
    }

    let html = await page.content();
    let $ = cheerio.load(html);

    // Use Cheerio selectors to extract the schedule data
    const dashboardSelector = "div[class=trip-dashboard]"
    let tripDashboardHtml = $(dashboardSelector).html();
    // WHile schedule contains the word "Loading", wait for the page to load
    attempt = 1;
    while (tripDashboardHtml.includes("Loading")) {
        console.log("attempt loading trip dashboard element: ", attempt++);
        if (attempt > 10) {
            throw new Error("Unable to load trip dashboard component.");
        }
        await page.waitForLoadState('domcontentloaded');
        if (!HEADLESS) { await page.screenshot({ path: `${process.env.HOME}/Downloads/finally-idle2.png` }); }
        html = await page.content();
        $ = cheerio.load(html);
        tripDashboardHtml = $(dashboardSelector).html();
    }

    // replace any relative links with absolute links
    tripDashboardHtml = makeRelativeLinksAbsolute(tripDashboardHtml);
    let nextTripDetailsHtml = await extractNextRideDetailsHtml(tripDashboardHtml, page);
    await page.close();
    await browser.close();
    return nextTripDetailsHtml;

}

async function extractNextRideDetailsHtml(tripDashboardHtml, page) {
    // check the schedule object, which is html text, for an anchor element with inner text "See trip details"
    // if it exists, navigate to the href attribute and get the html text from that page
    const anchorSelector = "a:contains('See trip details')";
    const anchor = cheerio.load(tripDashboardHtml)(anchorSelector);
    let tripDate = undefined;
    let itinerary = undefined;

    if (anchor.length > 0) {
        const href = anchor.attr('href');
        if (href.length > 0) {
            console.log("Navigating to trip details page:", href);
            await page.goto(href);
            //  im waiting for all of them bc im not sure which on in this case lol
            await page.waitForLoadState('domcontentloaded');
            await page.waitForLoadState('load');
            await page.waitForLoadState('networkidle');
            if (!HEADLESS)
                await page.screenshot({ path: `${process.env.HOME}/Downloads/see-details.png` });
            html = await page.content();
            $ = cheerio.load(html);

            const tripDateSelector = "div[class=trip-date]";
            tripDate = $(tripDateSelector).html();
            tripDate = makeRelativeLinksAbsolute(tripDate);

            const itinerarySelector = "div[class=itinerary]";
            itinerary = $(itinerarySelector).html();
            itinerary = makeRelativeLinksAbsolute(itinerary);
        }
    }

    if (!itinerary) return null;

    return `${tripDate}\n${itinerary}`;
}

async function getUpcomingTripsHtml(exclude_cancelled, max_rides) {
    const { browser, page } = await getAuthenticatedChromium();

    const upcomingTripsUrl = 'https://aar.mta.info/trips/upcoming';
    await page.goto(upcomingTripsUrl);
    await page.waitForLoadState('domcontentloaded');
    
    //  im waiting for all of them bc im not sure which on in this case lol
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    if (!HEADLESS) {
        await page.screenshot({ path: `${process.env.HOME}/Downloads/pre-upcoming-trips.png` });
    }

    let html = await page.content();
    let reservations = extractUpcomingTripDetails(html);
    if (exclude_cancelled) {
        reservations = reservations.filter(reservation => reservation.status !== 'Cancelled');
    }

    if (max_rides && reservations.length > max_rides) {
        reservations = reservations.slice(0, max_rides);
    }

    let returnHtml = "<div>" + reservations.map(reservation => 
        `<div style="border: 1px solid black; padding: 10px; margin: 10px;">
            <p><b>${reservation.date} | ${reservation.time}</b> (${reservation.status})</p>
            <ul>
                <li> <b>Pick Up:</b> ${reservation.from}.</li>
                <li> <b>Drop Off:</b> ${reservation.to}.</li>
            </ul>
        </div>`
    ).join('\n') + "</div>";

    await page.close();
    await browser.close();
    return returnHtml;
}

function extractUpcomingTripDetails(html) {
    const $ = cheerio.load(html);
    const reservations = [];

    $('.trip-schedule-details').each((_, element) => {
        const tripElement = $(element);

        // Extracting status (e.g., Scheduled, Cancelled)
        const status = tripElement.find('.trip-status .state-label').text().trim();

        // Extracting reservation date and time
        const time = tripElement.find('.trip-date div').text().replace('Reservation Pick-Up Time: ', '').trim();
        const date = tripElement.find('.trip-time').text().trim();

        // Extracting trip locations
        const from = tripElement.find('.trip-from span').first().text().trim();
        const to = tripElement.find('.trip-to span').first().text().trim();

        // Add extracted details to list
        reservations.push({ date, time, status, from, to });
    });

    return reservations;
}


module.exports.getNextTripDetailsHtml = getNextTripDetailsHtml;
module.exports.getUpcomingTripsHtml = getUpcomingTripsHtml;