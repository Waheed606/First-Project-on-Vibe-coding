import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Simple in-memory cache configuration
feed_cache = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION_SECS = 900  # Cache for 15 minutes

def clean_html_content(content):
    """
    Cleans and standardizes the HTML content from the feed.
    Also ensures external links open in a new tab.
    """
    if not content:
        return ""
    
    # Make all external links open in a new tab with safety attributes
    content = re.sub(
        r'<a\s+(?!.*?target=)', 
        r'<a target="_blank" rel="noopener noreferrer" ', 
        content
    )
    
    # Normalize headers inside content to have uniform styling classes
    # e.g., <h3>Feature</h3> -> <h3 class="note-type feature">Feature</h3>
    def replace_headers(match):
        header_text = match.group(1)
        lower_text = header_text.lower()
        badge_class = "general"
        if "feature" in lower_text:
            badge_class = "feature"
        elif "fix" in lower_text:
            badge_class = "fix"
        elif "change" in lower_text:
            badge_class = "change"
        elif "deprecation" in lower_text:
            badge_class = "deprecation"
        elif "security" in lower_text:
            badge_class = "security"
        elif "announcement" in lower_text:
            badge_class = "announcement"
            
        return f'<h3 class="release-note-header note-type-{badge_class}">{header_text}</h3>'
        
    content = re.sub(r'<h3>(.*?)</h3>', replace_headers, content)
    content = re.sub(r'<h4>(.*?)</h4>', replace_headers, content)
    
    return content

def fetch_and_parse_feed():
    """
    Fetches the BigQuery release notes Atom feed and parses it.
    """
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_el = entry.find('atom:title', ns)
        updated_el = entry.find('atom:updated', ns)
        id_el = entry.find('atom:id', ns)
        content_el = entry.find('atom:content', ns)
        link_el = entry.find('atom:link', ns)
        
        title = title_el.text if title_el is not None else "Unknown Date"
        updated = updated_el.text if updated_el is not None else ""
        entry_id = id_el.text if id_el is not None else ""
        raw_content = content_el.text if content_el is not None else ""
        
        link = ""
        if link_el is not None:
            link = link_el.attrib.get('href', '')
        if not link and entry_id.startswith('http'):
            link = entry_id
            
        # Parse out categories to help frontend filters
        categories = set()
        lower_content = raw_content.lower()
        
        # Check standard headers
        if "<h3>feature</h3>" in lower_content or "<h4>feature</h4>" in lower_content or "<strong>feature:</strong>" in lower_content:
            categories.add("Feature")
        if "<h3>change</h3>" in lower_content or "<h4>change</h4>" in lower_content or "<strong>change:</strong>" in lower_content:
            categories.add("Change")
        if "<h3>fix</h3>" in lower_content or "<h4>fix</h4>" in lower_content or "<strong>fix:</strong>" in lower_content:
            categories.add("Fix")
        if "<h3>deprecation</h3>" in lower_content or "<h4>deprecation</h4>" in lower_content or "<strong>deprecation:</strong>" in lower_content:
            categories.add("Deprecation")
        if "<h3>security</h3>" in lower_content or "<h4>security</h4>" in lower_content:
            categories.add("Security")
        if "announcement" in lower_content or "announce" in lower_content:
            categories.add("Announcement")
            
        # Fallback if no specific tags found
        if not categories:
            # Look for any custom <h3> tags
            custom_headers = re.findall(r'<h3>(.*?)</h3>', raw_content)
            for ch in custom_headers:
                ch_clean = ch.strip()
                if len(ch_clean) < 20 and not ch_clean.startswith('<'):
                    categories.add(ch_clean)
                    
        if not categories:
            categories.add("General")
            
        cleaned_content = clean_html_content(raw_content)
        
        entries.append({
            "id": entry_id,
            "title": title,
            "updated": updated,
            "content": cleaned_content,
            "link": link,
            "categories": list(categories)
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Serve from cache if valid and not forced to refresh
    if not force_refresh and feed_cache["data"] is not None and (current_time - feed_cache["last_updated"] < CACHE_DURATION_SECS):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": feed_cache["last_updated"],
            "data": feed_cache["data"]
        })
        
    try:
        data = fetch_and_parse_feed()
        feed_cache["data"] = data
        feed_cache["last_updated"] = current_time
        return jsonify({
            "status": "success",
            "source": "network",
            "last_updated": current_time,
            "data": data
        })
    except Exception as e:
        # If network fetch fails but we have stale cache, return it with a warning
        if feed_cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to fetch latest notes ({str(e)}). Displaying cached data.",
                "source": "stale_cache",
                "last_updated": feed_cache["last_updated"],
                "data": feed_cache["data"]
            })
            
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    # Start the server on port 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
