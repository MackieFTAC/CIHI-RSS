const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { XMLBuilder } = require('fast-xml-parser');

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

function saveUpdatedData(newItems) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(newItems, null, 2));
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
        
    console.log('Saving updated history...');
    saveUpdatedData(newItems);

    console.log('Generating RSS feed...');
    const rssXML = generateRSSFeed(newItems);
    fs.writeFileSync(RSS_FILE, rssXML);   
            
    console.log('RSS feed updated successfully.');
}
        
updateRSSFeed();

