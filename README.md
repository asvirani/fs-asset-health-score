# Asset Health Score — Lightning Web Component

A premium, standalone LWC component that calculates and displays a dynamic health score for Field Service assets. Designed for Salesforce demo orgs with Field Service and Asset Lifecycle Management (ASLM) installed.

![Asset Health Score](screenshots/placeholder.png)

## Features

- **Semi-Circle Gauge** — Animated 0-100 health score with color gradient (red → yellow → green), glow effects, and score label (Critical / At Risk / Fair / Good / Excellent)
- **Contributing Factors** — Expandable breakdown of what drives the score:
  - Work Order History (35%) — WO frequency, open vs closed ratio, priority
  - Warranty Status (25%) — Active/expired warranty, days remaining
  - Case History & Sentiment (40%) — Open cases, escalations, resolution time
- **6-Month Trend Sparkline** — Score trend over time with direction indicator
- **Predicted Failure Date** — Estimated days until failure with confidence %, based on similar asset patterns
- **Agentforce Recommendation** — AI-styled action card with "Create Work Order" quick action button

## Score Calculation

Scores are computed dynamically from real org data — not hardcoded. Each asset gets a unique score based on its actual Work Orders, Cases, and Warranty records. The score changes as records are created or resolved.

## Prerequisites

- Salesforce org with **Field Service** managed package installed
- **Asset Lifecycle Management (ASLM)** enabled
- Assets with related Work Orders, Cases, and/or AssetWarranty records

## Installation

### Option 1: Deploy via SF CLI

```bash
git clone https://github.com/armaan-virani/fs-asset-health-score.git
cd fs-asset-health-score
sf project deploy start --source-dir force-app --target-org <your-org-alias>
```

### Option 2: Deploy via Manifest

```bash
sf project deploy start --manifest manifest/package.xml --target-org <your-org-alias>
```

## Configuration

1. Navigate to any **Asset** record page in your org
2. Click the gear icon → **Edit Page** to open Lightning App Builder
3. Search for **"Asset Health Score"** in the Components panel
4. Drag it onto the page layout
5. Save and activate

The component automatically picks up the record ID from the page context — no configuration properties needed.

## Component Structure

```
force-app/main/default/
├── classes/
│   ├── AssetHealthScoreController.cls          # Apex controller with score logic
│   ├── AssetHealthScoreController.cls-meta.xml
│   ├── AssetHealthScoreControllerTest.cls      # Test class (SeeAllData for demo orgs)
│   └── AssetHealthScoreControllerTest.cls-meta.xml
└── lwc/
    └── sfs_assetHealthScore/
        ├── sfs_assetHealthScore.html            # Template with gauge, factors, sparkline
        ├── sfs_assetHealthScore.js              # Controller with animations and navigation
        ├── sfs_assetHealthScore.css             # Premium styling
        └── sfs_assetHealthScore.js-meta.xml     # Lightning App Builder config
```

## Screenshots

_Add screenshots here after deploying to your org._

## License

Internal use only — Salesforce demo org toolkit.
