import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getHealthScore from '@salesforce/apex/AssetHealthScoreController.getHealthScore';
import resolveAssetId from '@salesforce/apex/AssetHealthScoreController.resolveAssetId';

const SCORE_COLORS = {
    critical: '#ea001e',
    atRisk: '#fe5d00',
    fair: '#e4a201',
    good: '#2e844a',
    excellent: '#0d9d57'
};

const GAUGE_RADIUS = 120;
const GAUGE_CX = 150;
const GAUGE_CY = 140;

// Severity zone boundaries (score ranges) and colors for the gauge track
const GAUGE_ZONES = [
    { min: 0, max: 40, color: '#ef4444', key: 'zone-critical' },
    { min: 40, max: 51, color: '#f97316', key: 'zone-atrisk' },
    { min: 51, max: 71, color: '#eab308', key: 'zone-fair' },
    { min: 71, max: 85, color: '#22c55e', key: 'zone-good' },
    { min: 85, max: 100, color: '#10b981', key: 'zone-excellent' }
];

export default class Sfs_assetHealthScore extends NavigationMixin(LightningElement) {
    @api recordId;

    healthData;
    error;
    isLoading = true;
    animatedScore = 0;
    expandedFactors = {};
    resolvedAssetId;
    isDetailsExpanded = false;

    // Step 1: Resolve the AssetId (handles both Asset and WorkOrder pages)
    @wire(resolveAssetId, { recordId: '$recordId' })
    wiredResolve({ error, data }) {
        if (data) {
            this.resolvedAssetId = data;
            this.error = undefined;
        } else if (data === null) {
            this.error = 'This work order has no associated asset.';
            this.isLoading = false;
        } else if (error) {
            this.error = error.body?.message || 'Unable to resolve asset';
            this.isLoading = false;
        }
    }

    // Step 2: Fetch health score using the resolved AssetId
    @wire(getHealthScore, { assetId: '$resolvedAssetId' })
    wiredHealth({ error, data }) {
        if (data) {
            this.healthData = data;
            this.error = undefined;
            this.isLoading = false;
            this.animateScore(data.overallScore);
        } else if (error) {
            this.error = error.body?.message || 'Unable to calculate health score';
            this.healthData = undefined;
            this.isLoading = false;
        }
    }

    // ─── Score Animation ───────────────────────────────────────────

    animateScore(target) {
        this.animatedScore = 0;
        const duration = 1200;
        const startTime = performance.now();

        const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            this.animatedScore = Math.round(eased * target);

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }

    // ─── Asset Name ──────────────────────────────────────────────

    get assetName() {
        return this.healthData?.assetName ?? 'Asset';
    }

    // ─── Gauge Computed Properties ─────────────────────────────────

    get scoreColor() {
        const s = this.healthData?.overallScore ?? 0;
        if (s >= 85) return SCORE_COLORS.excellent;
        if (s >= 71) return SCORE_COLORS.good;
        if (s >= 51) return SCORE_COLORS.fair;
        if (s >= 41) return SCORE_COLORS.atRisk;
        return SCORE_COLORS.critical;
    }

    get scoreLabel() {
        return this.healthData?.scoreLabel ?? '';
    }

    get gaugeArcPath() {
        const startAngle = Math.PI;
        const endAngle = 0;
        const x1 = GAUGE_CX + GAUGE_RADIUS * Math.cos(startAngle);
        const y1 = GAUGE_CY + GAUGE_RADIUS * Math.sin(startAngle);
        const x2 = GAUGE_CX + GAUGE_RADIUS * Math.cos(endAngle);
        const y2 = GAUGE_CY + GAUGE_RADIUS * Math.sin(endAngle);
        return `M ${x1} ${y1} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${x2} ${y2}`;
    }

    get gaugeArcLength() {
        return Math.PI * GAUGE_RADIUS;
    }

    get gaugeFilledLength() {
        const score = this.animatedScore;
        return (score / 100) * this.gaugeArcLength;
    }

    get gaugeEmptyLength() {
        return this.gaugeArcLength - this.gaugeFilledLength;
    }

    get gaugeArcStyle() {
        const filled = this.gaugeFilledLength;
        const empty = this.gaugeEmptyLength;
        return `stroke-dasharray: ${filled} ${empty}; filter: drop-shadow(0 0 8px ${this.scoreColor}80);`;
    }

    get gaugeArcStyleClean() {
        const filled = this.gaugeFilledLength;
        const empty = this.gaugeEmptyLength;
        return `stroke-dasharray: ${filled} ${empty};`;
    }

    get scoreDisplayX() {
        return GAUGE_CX;
    }

    get scoreDisplayY() {
        return GAUGE_CY - 10;
    }

    get scoreLabelY() {
        return GAUGE_CY + 25;
    }

    // ─── Gauge Severity Zones ────────────────────────────────────

    get gaugeZones() {
        const totalArc = this.gaugeArcLength;
        return GAUGE_ZONES.map((zone) => {
            const startFraction = zone.min / 100;
            const endFraction = zone.max / 100;
            const segmentLength = (endFraction - startFraction) * totalArc;
            const offset = startFraction * totalArc;
            const gap = totalArc - segmentLength;
            return {
                key: zone.key,
                color: zone.color,
                dashStyle: `stroke-dasharray: ${segmentLength} ${gap}; stroke-dashoffset: -${offset};`
            };
        });
    }

    // ─── Factors ─────────────────────────────────────────────────

    get factors() {
        if (!this.healthData?.factors) return [];
        return this.healthData.factors.map((f, idx) => {
            const key = `factor-${idx}`;
            const isExpanded = this.expandedFactors[key] === true;
            return {
                ...f,
                key,
                barWidth: `width: ${f.score}%`,
                barClass: `factor-bar factor-bar--${f.status}`,
                statusIcon: this.getStatusIcon(f.status),
                statusClass: `factor-status factor-status--${f.status}`,
                scoreClass: `factor-score factor-score--${f.status}`,
                isExpanded,
                expandIcon: isExpanded ? 'utility:chevrondown' : 'utility:chevronright',
                weightLabel: `${f.weight}%`
            };
        });
    }

    getStatusIcon(status) {
        if (status === 'green') return 'utility:success';
        if (status === 'yellow') return 'utility:warning';
        return 'utility:error';
    }

    handleFactorToggle(event) {
        const key = event.currentTarget.dataset.key;
        this.expandedFactors = {
            ...this.expandedFactors,
            [key]: !this.expandedFactors[key]
        };
    }

    // ─── Sparkline ──────────────────────────────────────────────

    get sparklinePoints() {
        if (!this.healthData?.trendData) return '';
        const data = this.healthData.trendData;
        const width = 280;
        const height = 68;
        const padding = 10;

        const xStep = (width - padding * 2) / (data.length - 1);

        return data.map((d, i) => {
            const x = padding + i * xStep;
            const y = height - padding - ((d.score / 100) * (height - padding * 2));
            return `${x},${y}`;
        }).join(' ');
    }

    get sparklineAreaPoints() {
        if (!this.healthData?.trendData) return '';
        const data = this.healthData.trendData;
        const width = 280;
        const height = 68;
        const padding = 10;

        const xStep = (width - padding * 2) / (data.length - 1);
        const bottom = height - padding;

        const linePoints = data.map((d, i) => {
            const x = padding + i * xStep;
            const y = height - padding - ((d.score / 100) * (height - padding * 2));
            return `${x},${y}`;
        });

        const lastX = padding + (data.length - 1) * xStep;
        const firstX = padding;

        return `${firstX},${bottom} ${linePoints.join(' ')} ${lastX},${bottom}`;
    }

    get sparklineDots() {
        if (!this.healthData?.trendData) return [];
        const data = this.healthData.trendData;
        const width = 280;
        const height = 68;
        const padding = 10;
        const xStep = (width - padding * 2) / (data.length - 1);

        return data.map((d, i) => ({
            key: `dot-${i}`,
            cx: padding + i * xStep,
            cy: height - padding - ((d.score / 100) * (height - padding * 2)),
            label: d.month,
            labelX: padding + i * xStep,
            labelY: height + 6,
            score: d.score
        }));
    }

    // ─── Sparkline Reference Zones ──────────────────────────────

    _sparklineY(score) {
        const height = 68;
        const padding = 10;
        return height - padding - ((score / 100) * (height - padding * 2));
    }

    // Good zone: 70-100
    get sparklineZoneGoodY() { return this._sparklineY(100); }
    get sparklineZoneGoodH() { return this._sparklineY(70) - this._sparklineY(100); }
    get sparklineZoneGoodLabelY() { return this._sparklineY(85) + 2; }

    // Fair zone: 40-70
    get sparklineZoneFairY() { return this._sparklineY(70); }
    get sparklineZoneFairH() { return this._sparklineY(40) - this._sparklineY(70); }

    // Poor zone: 0-40
    get sparklineZonePoorY() { return this._sparklineY(40); }
    get sparklineZonePoorH() { return this._sparklineY(0) - this._sparklineY(40); }
    get sparklineZonePoorLabelY() { return this._sparklineY(20) + 2; }

    // ─── Trend ──────────────────────────────────────────────────

    get trendDirection() {
        if (!this.healthData?.trendData || this.healthData.trendData.length < 2) return '';
        const data = this.healthData.trendData;
        const first = data[0].score;
        const last = data[data.length - 1].score;
        if (last > first) return 'improving';
        if (last < first) return 'declining';
        return 'stable';
    }

    get trendLabel() {
        if (this.trendDirection === 'improving') return '↑ Improving';
        if (this.trendDirection === 'declining') return '↓ Declining';
        return '→ Stable';
    }

    get trendClass() {
        return `trend-indicator trend-indicator--${this.trendDirection}`;
    }

    // ─── Metrics ────────────────────────────────────────────────

    get metrics() {
        if (!this.healthData?.metrics) return [];
        return this.healthData.metrics.map((m, idx) => ({
            ...m,
            key: `metric-${idx}`
        }));
    }

    // ─── Recommendation ─────────────────────────────────────────

    get recommendation() {
        return this.healthData?.recommendation;
    }

    get recommendationClass() {
        const urgency = this.recommendation?.urgency ?? 'info';
        return `recommendation-card recommendation-card--${urgency}`;
    }

    get recommendationButtonVariant() {
        const urgency = this.recommendation?.urgency ?? 'info';
        if (urgency === 'critical') return 'destructive';
        if (urgency === 'warning') return 'brand';
        return 'neutral';
    }

    handleCreateWorkOrder() {
        const assetId = this.resolvedAssetId || this.recordId;
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'WorkOrder',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `AssetId=${assetId}`
            }
        });
    }

    // ─── Details Expand/Collapse ────────────────────────────────

    handleDetailsToggle() {
        this.isDetailsExpanded = !this.isDetailsExpanded;
    }

    get isDetailsCollapsed() {
        return !this.isDetailsExpanded;
    }

    get detailsToggleLabel() {
        return this.isDetailsExpanded ? 'Hide Details' : 'Show Details';
    }

    get detailsToggleIconClass() {
        return this.isDetailsExpanded
            ? 'details-toggle-icon details-toggle-icon--open'
            : 'details-toggle-icon';
    }

    // ─── Misc ───────────────────────────────────────────────────

    get lastCalculated() {
        if (!this.healthData?.lastCalculated) return '';
        const dt = new Date(this.healthData.lastCalculated);
        return dt.toLocaleString();
    }

    get hasData() {
        return this.healthData != null;
    }
}
