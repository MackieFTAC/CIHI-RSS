import requests
from bs4 import BeautifulSoup
from feedgen.feed import FeedGenerator
import json
import os
from datetime import datetime

# URL of CIHI data tables page
CIHI_URL = "https://www.cihi.ca/en/access-data-and-reports/data-tables"
FEED_FILE = "cihi_data_feed.xml"
HISTORY_FILE = "cihi_data_history.json"

def fetch_data():
    """Scrapes CIHI website and extracts new data table links."""
    response = requests.get(CIHI_URL)
    if response.status_code != 200:
        print(f"Failed to fetch data: {response.status_code}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    items = []
    
    for article in soup.find_all("article", class_="c-card"):
        title_tag = article.find("h3", class_="c-card__title")
        if title_tag and title_tag.a:
            title = title_tag.a.text.strip()
            link = title_tag.a["href"]
            if not link.startswith("http"):
                link = f"https://www.cihi.ca{link}"
            
            items.append({"title": title, "link": link, "date": datetime.utcnow().isoformat()})
    
    return items

def load_history():
    """Loads previously stored items to avoid duplicates."""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []

def save_history(items):
    """Saves latest data tables to prevent duplicates."""
    with open(HISTORY_FILE, "w") as f:
        json.dump(items, f, indent=4)

def generate_rss_feed(new_items):
    """Creates an RSS feed from the scraped data."""
    fg = FeedGenerator()
    fg.title("CIHI Data Tables")
    fg.link(href=CIHI_URL, rel="self")
    fg.description("Latest CIHI data tables published online.")
    
    for item in new_items:
        entry = fg.add_entry()
        entry.title(item["title"])
        entry.link(href=item["link"])
        entry.description(f"New dataset: {item['title']}")
        entry.pubDate(datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT"))
    
    fg.rss_file(FEED_FILE)

def main():
    """Main function to scrape, compare, and update RSS feed."""
    new_items = fetch_data()
    old_items = load_history()

    # Find only new entries
    fresh_items = [item for item in new_items if item["link"] not in {i["link"] for i in old_items}]
    
    if fresh_items:
        print(f"Found {len(fresh_items)} new data tables!")
        all_items = fresh_items + old_items[:50]  # Keep latest 50 items
        save_history(all_items)
        generate_rss_feed(all_items)
    else:
        print("No new data tables found.")

if __name__ == "__main__":
    main()

