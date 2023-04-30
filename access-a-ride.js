const cheerio = require('cheerio');
const {chromium} = require('playwright');
dotenv = require('dotenv');
dotenv.config();

const MTA_USERNAME = process.env.MTA_USERNAME;
const MTA_PASSWORD = process.env.MTA_PASSWORD;
const HEADLESS = process.env.NODE_ENV === 'production' ? true : false;


function makeRelativeLinksAbsolute(html){
    // replace any relative links with absolute links
    return html.replace(/href="\//g, 'href="https://aar.mta.info/');
}

/**
 * Get authentication tokens from MTA website, which is a React application
 */
async function getAuthenticatedChromium(){
    const loginPage = 'https://aar.mta.info/login';
    const browser = await chromium.launch({headless: HEADLESS});
    const page = await browser.newPage();

    // Navigate to login page
    await page.goto(loginPage);
    await page.waitForLoadState('networkidle');

    if(!HEADLESS)
        await page.screenshot({path: `${process.env.HOME}/Downloads/pre-login.png`});
    
    // Enter username and password and submit
    await page.type(`input[name="username"]`, MTA_USERNAME);
    await page.type(`input[name="password"]`, MTA_PASSWORD);

    // Click the login button, which is a button with type="submit"
    await page.click(`button[type="submit"]`);
    
    // return the authenticated browser and the page
    if(!HEADLESS)
        await page.screenshot({path: `${process.env.HOME}/Downloads/post-login.png`});
    
    return {browser, page};
}


/**
 * Obtain the schedule form the trip-dashboard component. If trip details are available, 
 * obtain and return that instead since it contains more accurate information.
 * 
 * @returns 
 */
async function getSchedule(){
    const url = 'https://aar.mta.info/trip-booking';
        const selector = "div[class=trip-dashboard]"

        const {browser, page} = await getAuthenticatedChromium();
        // await page.goto(url);
        // await page.waitForLoadState('networkidle');

        if(!HEADLESS)
            await page.screenshot({path: `${process.env.HOME}/Downloads/pre-cheerio.png`});
    
        // get page's url
        let pageUrl = page.url();
        console.log("\n\n Page URL:\n", pageUrl);
        
        while(pageUrl !== url){
            console.log("whilin' out");
            await page.waitForLoadState('networkidle');
            if(!HEADLESS)
                await page.screenshot({path: `${process.env.HOME}/Downloads/finally-idle.png`});
            pageUrl = page.url();
            console.log("\n\n Page URL:\n", pageUrl);
        }

        let html = await page.content();
        let $ = cheerio.load(html);

        // Use Cheerio selectors to extract the schedule data
        let schedule = $(selector).html();
        // WHile schedule contains the word "Loading", wait for the page to load
        while(schedule.includes("Loading")){
            console.log("whilin' out again");
            await page.waitForLoadState('networkidle');
            if(!HEADLESS)
                await page.screenshot({path: `${process.env.HOME}/Downloads/finally-idle2.png`});
            html = await page.content();
            $ = cheerio.load(html);
            schedule = $(selector).html();
        }

        // replace any relative links with absolute links
        schedule = makeRelativeLinksAbsolute(schedule);
        
        // check the schedule object, which is html text, for an anchor element with inner text "See trip details"
        // if it exists, navigate to the href attribute and get the html text from that page
        const anchorSelector = "a:contains('See trip details')";
        const anchor = cheerio.load(schedule)(anchorSelector);
        if(anchor.length > 0){
            const href = anchor.attr('href');
            console.log("\n\n see details href:\n", href);
            if(href.length > 0){
                await page.goto(href);
                await page.waitForLoadState('networkidle');
                if(!HEADLESS)
                    await page.screenshot({path: `${process.env.HOME}/Downloads/see-details.png`});
                html = await page.content();
                $ = cheerio.load(html);
                const itinerarySelector = "div[class=itinerary]";
                schedule = $(itinerarySelector).html();
                schedule = makeRelativeLinksAbsolute(schedule);
                
            }
            
        }

        await page.close();
        await browser.close();
        return schedule;

}
    

module.exports.getSchedule =  getSchedule;