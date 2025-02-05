const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');

const CIHI_URL = 'https://www.cihi.ca/en/access-data-and-reports/data-tables';
const RSS_FILE = 'cihi_data_feed.xml';
const HISTORY_FILE = 'cihi_data_history.json';

async function fetchCIHIData() {
    try {
        const response = await axios.get(CIHI_URL);
        const $ = cheerio.load(response.data);
        const items = [];

        $('div.views-row').each((index, element) => {
            const linkElement = $(element).find('h3.c-card__title a');
            const title = linkElement.text().trim();
            const link = linkElement.attr('href');
            const description = $(element).find('.c-card__content').text().trim();
            const date = $(element).find('time').attr('datetime') || new Date().toISOString();

            if (title && link) {
                items.push({
                    title,
                    link: link.startsWith('http') ? link : `https://www.cihi.ca${link}`,
                    description,
                    pubDate: new Date(date).toUTCString()
                });
            }
        });

        return items;
    } catch (error) {
        console.error('Error fetching CIHI data:', error);
        return [];
    }
}

function loadPreviousData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
    return [];
}

function loadExistingRSS() {
    try {
        if (fs.existsSync(RSS_FILE)) {
            const rssData = fs.readFileSync(RSS_FILE, 'utf-8');
            const parser = new XMLParser({ ignoreAttributes: false });
            const parsedXML = parser.parse(rssData);

            return parsedXML.rss.channel.item || [];
        }
    } catch (error) {
        console.error('Error loading existing RSS feed:', error);
    }
    return [];
}

function saveUpdatedData(newItems, allItems) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(allItems, null, 2));
}

function generateRSSFeed(items) {
    const rssFeed = {
        rss: {
            '@_version': '2.0',
            channel: {
                title: 'CIHI Data Tables RSS Feed',
                link: CIHI_URL,
                description: 'Updates on new data tables published by CIHI.',
                lastBuildDate: new Date().toUTCString(),
                item: items.map(item => ({
                    title: item.title,
                    link: item.link,
                    description: item.description,  
                    pubDate: item.pubDate
                }))
            }
        }
    };

    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    return builder.build(rssFeed);
}

async function updateRSSFeed() {
    console.log('Fetching CIHI data...');
    const newItems = await fetchCIHIData();
    if (newItems.length === 0) {
        console.log('No new items found.');
        return;
    }

    const oldItems = loadPreviousData();
    const existingRSSItems = loadExistingRSS();

    // Ensure items are unique and not duplicated
    const existingLinks = new Set(existingRSSItems.map(item => item.link));
    const newEntries = newItems.filter(item => !existingLinks.has(item.link));

    if (newEntries.length > 0) {
        console.log(`Found ${newEntries.length} new items!`);

        // Combine new entries with existing ones, keeping only the latest 50
        const updatedItems = [...newEntries, ...existingRSSItems].slice(0, 50);
        saveUpdatedData(updatedItems, updatedItems);

        // Generate RSS feed with new and old data
        console.log('Generating RSS feed...');
        const rssXML = generateRSSFeed(updatedItems);
        fs.writeFileSync(RSS_FILE, rssXML);

        console.log('RSS feed updated successfully.');
    } else {
        console.log('No new data. No update required.');
    }
}

updateRSSFeed();

