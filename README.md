# Enhanced Asset Health Score — Lightning Web Component

A premium, standalone LWC component that calculates and displays a dynamic health score for Field Service assets. Designed for Salesforce demo orgs with Field Service and Asset Lifecycle Management (ASLM) installed.

![Asset Health Score](screenshots/placeholder.png)

## Features

- **Semi-Circle Gauge** — Animated 0-100 health score with color gradient, glow effects, and score label (Critical / At Risk / Fair / Good / Excellent)
- **Contributing Factors** — Expandable breakdown of what drives the score:
  - Work Order History (35%) — WO frequency, open vs closed ratio, priority
  - Warranty Status (25%) — Active/expired warranty, days remaining
  - Case History & Sentiment (40%) — Open cases, escalations, resolution time
- **Age & Usage Metrics** — 6 ASLM-standard metrics in a 2-column grid:
  - Age, Days Since Installation, Total Usage, Hours, Repairs, Repairs in Last 6 Months
- **6-Month Trend Sparkline** — Score trend over time with direction indicator
- **Agentforce Recommendation** — AI-styled action card with "Create Work Order" quick action button
- **Works on Asset and Work Order pages** — Automatically resolves the asset from either context

## Package Info

| | |
|---|---|
| **Package Name** | Enhanced Asset Health Score |
| **Package Id** | `0HoKa000000sgNHKAY` |
| **Version** | 1.0.0.1 |
| **Version Id** | `04tKa000002znWHIAY` |
| **Type** | Unlocked (no namespace) |
| **Status** | Released |

## Installation

### Option 1: Install Unlocked Package (Recommended)

Click the link or run the CLI command:

**[Install in Production/Developer Org](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tKa000002znWHIAY)**

**[Install in Sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tKa000002znWHIAY)**

Or via CLI:

```bash
sf package install --package 04tKa000002znWHIAY --target-org <your-org-alias> --wait 10
```

### Option 2: Deploy Source Directly

```bash
git clone https://github.com/asvirani/fs-asset-health-score.git
cd fs-asset-health-score
sf project deploy start --source-dir force-app --target-org <your-org-alias>
```

### Option 3: Deploy via Manifest

```bash
sf project deploy start --manifest manifest/package.xml --target-org <your-org-alias>
```

## Configuration

1. Navigate to any **Asset** or **Work Order** record page in your org
2. Click the gear icon → **Edit Page** to open Lightning App Builder
3. Search for **"Enhanced Asset Health Score"** in the Components panel
4. Drag it onto the page layout
5. Save and activate

The component automatically picks up the record ID from the page context — no configuration properties needed. On Work Order pages, it resolves the linked asset automatically.

## How the Score is Calculated

The overall score is a weighted composite of three factors, computed dynamically from real org data:

| Factor | Weight | Data Source |
|--------|--------|-------------|
| **Case History & Sentiment** | 40% | `Case` records linked to the asset — open count, escalations, priority, volume, resolution time |
| **Work Order History** | 35% | `WorkOrder` records — frequency, open/closed ratio, priority distribution |
| **Warranty Status** | 25% | `AssetWarranty` records + `Entitlement_Status__c` field on Asset |

### Age & Usage Metrics

| Metric | Source |
|--------|--------|
| Age | Calculated from `Asset.InstallDate` |
| Days Since Installation | Raw day count from `Asset.InstallDate` |
| Total Usage | `Asset.TotalUsage__c` + `Asset.TotalUsageUOM__c` |
| Hours | `Asset.AverageUptimePerDay` x days (or ~16 hr/day estimate) |
| Repairs | Count of repair-type `WorkOrder` records |
| Repairs in Last 6 Months | Same filter, last 6 months |

## Prerequisites

- Salesforce org with **Field Service** managed package installed
- **Asset Lifecycle Management (ASLM)** enabled (recommended)
- Assets with related Work Orders, Cases, and/or AssetWarranty records

The package includes the custom fields it needs (`Entitlement_Status__c`, `TotalUsage__c`, `TotalUsageUOM__c`) — they will be created on install if they don't already exist.

## Component Structure

```
force-app/main/default/
├── classes/
│   ├── AssetHealthScoreController.cls            # Apex controller with score engine
│   ├── AssetHealthScoreController.cls-meta.xml
│   ├── AssetHealthScoreControllerTest.cls        # Test class (8 tests)
│   └── AssetHealthScoreControllerTest.cls-meta.xml
├── lwc/
│   └── sfs_assetHealthScore/
│       ├── sfs_assetHealthScore.html              # Template — gauge, factors, metrics, sparkline
│       ├── sfs_assetHealthScore.js                # Controller — animations, navigation, data wiring
│       ├── sfs_assetHealthScore.css               # Premium styling
│       └── sfs_assetHealthScore.js-meta.xml       # App Builder config (Asset + WorkOrder)
└── objects/
    └── Asset/
        └── fields/
            ├── Entitlement_Status__c.field-meta.xml
            ├── TotalUsage__c.field-meta.xml
            └── TotalUsageUOM__c.field-meta.xml
```

## Screenshots

_Add screenshots here after deploying to your org._

## License

Internal use only — Salesforce demo org toolkit.
