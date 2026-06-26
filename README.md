# 📅 BigQuery Release Notes Explorer & Social Share

A premium, modern dashboard for tracking official Google BigQuery release notes and updates. The application fetches the official RSS Atom feed dynamically, parses and categorizes entries, and equips you with rich utilities to share highlights directly to X (formerly Twitter).

---

## 🌟 Key Features

* **⚡ Real-Time Feed Explorer**: Parses and serves the official GCP BigQuery release notes Atom feed dynamically.
* **📂 Smart Categorization**: Filters updates by type: *Features, Fixes, Changes, Deprecations, Security, Announcements, and General*.
* **🔍 Search & Filter**: Instantly search updates using keywords (e.g., storage, SQL, JSON) combined with category tags.
* **🐦 Advanced X/Twitter Sharing Options**:
  * **Direct Tweet**: Share individual updates in one click.
  * **🗂️ Multi-Card Digest Builder**: Select multiple updates using custom checkboxes to automatically compile a formatted, numbered digest tweet.
  * **🖱️ Contextual Highlight-to-Tweet**: Highlight any text within an update card to reveal a floating "Tweet Selection" button (Medium-style).
  * **⚙️ Content Customizer Modal**: Check/uncheck options in the modal to include or exclude category badges, date headers, and official documentation links in real-time.
  * **📊 Progress Ring Counter**: Displays a visual indicator tracking Twitter's 280-character limit, warning you when approaching the limit.
* **🎨 Premium Dark Theme**: Beautiful glassmorphic dark design utilizing smooth micro-animations, tailored HSL gradients, and responsive layouts.

---

## 🛠️ Technology Stack

* **Backend**: Python, Flask, `xml.etree.ElementTree` (standard library XML parser), `requests`.
* **Frontend**: HTML5 (semantic elements), Vanilla CSS3 (custom CSS custom properties, grid/flex layouts, CSS keyframe animations), Vanilla JavaScript (event delegation, TextRange selection API, SVG progress ring).

---

## 🚀 Getting Started

### Prerequisites
* Python 3.8 or higher
* Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Waheed606/First-Project-on-Vibe-coding.git
   cd First-Project-on-Vibe-coding
   ```

2. **Set up a Virtual Environment:**
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\activate.ps1
     ```
   * **Mac/Linux:**
     ```bash
     python -m venv .venv
     source .venv/bin/activate
     ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application:**
   ```bash
   python app.py
   ```

5. **Open in Browser:**
   Navigate to `http://localhost:5000` to start exploring and sharing updates.

---

## 📂 Project Structure

```text
├── app.py                # Flask server, parsing backend & in-memory cache
├── requirements.txt      # Python dependencies
├── .gitignore            # Git exclusion rules
├── README.md             # Project documentation
├── templates/
│   └── index.html        # Main app UI structure & social modals
└── static/
    ├── css/
    │   └── style.css     # CSS rules, themes & layout animations
    └── js/
        └── app.js        # DOM interaction, selection logic, & Twitter integration
```

---

## 🔒 License
This project is open source and available under the [MIT License](LICENSE).
