import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getHealthScore from '@salesforce/apex/AssetHealthScoreController.getHealthScore';
import resolveAssetId from '@salesforce/apex/AssetHealthScoreController.resolveAssetId';

const SCORE_COLORS = {
    critical: '#ef4444',
    atRisk: '#f97316',
    fair: '#eab308',
    good: '#22c55e',
    excellent: '#10b981'
};

const GAUGE_RADIUS = 120;
const GAUGE_CX = 150;
const GAUGE_CY = 140;

export default class Sfs_assetHealthScore extends NavigationMixin(LightningElement) {
    @api recordId;

    healthData;
    error;
    isLoading = true;
    animatedScore = 0;
    expandedFactors = {};
    resolvedAssetId;

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

    get scoreLabelClass() {
        const label = (this.healthData?.scoreLabel ?? '').toLowerCase().replace(/\s+/g, '-');
        return `score-label score-label--${label}`;
    }

    get gaugeArcPath() {
        // Semi-circle arc from left to right
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
        return `stroke-dasharray: ${filled} ${empty}; filter: drop-shadow(0 0 6px ${this.scoreColor}80);`;
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

    // ─── Factors ───────────────────────────────────────────────────

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

    // ─── Sparkline ─────────────────────────────────────────────────

    get sparklinePoints() {
        if (!this.healthData?.trendData) return '';
        const data = this.healthData.trendData;
        const width = 280;
        const height = 60;
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
        const height = 60;
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
        const height = 60;
        const padding = 10;
        const xStep = (width - padding * 2) / (data.length - 1);

        return data.map((d, i) => ({
            key: `dot-${i}`,
            cx: padding + i * xStep,
            cy: height - padding - ((d.score / 100) * (height - padding * 2)),
            label: d.month,
            labelX: padding + i * xStep,
            labelY: height + 2,
            score: d.score
        }));
    }

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

    // ─── Metrics ──────────────────────────────────────────────────

    get metrics() {
        if (!this.healthData?.metrics) return [];
        return this.healthData.metrics.map((m, idx) => ({
            ...m,
            key: `metric-${idx}`
        }));
    }

    // ─── Recommendation ────────────────────────────────────────────

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

    // ─── Misc ──────────────────────────────────────────────────────

    get lastCalculated() {
        if (!this.healthData?.lastCalculated) return '';
        const dt = new Date(this.healthData.lastCalculated);
        return dt.toLocaleString();
    }

    get hasData() {
        return this.healthData != null;
    }
}
