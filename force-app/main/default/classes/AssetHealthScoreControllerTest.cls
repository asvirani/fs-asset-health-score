@IsTest(SeeAllData=true)
private class AssetHealthScoreControllerTest {

    // Uses existing org data — this package targets internal demo orgs
    // with pre-populated Assets, Work Orders, Cases, and Warranties.

    private static Asset getAssetWithWorkOrders() {
        List<Asset> assets = [
            SELECT Id, Name, Entitlement_Status__c
            FROM Asset
            WHERE Id IN (SELECT AssetId FROM WorkOrder WHERE AssetId != null)
            AND Status = 'Installed'
            LIMIT 1
        ];
        return assets.isEmpty() ? null : assets[0];
    }

    private static Asset getAssetWithoutWorkOrders() {
        List<Asset> assets = [
            SELECT Id, Name, Entitlement_Status__c
            FROM Asset
            WHERE Id NOT IN (SELECT AssetId FROM WorkOrder WHERE AssetId != null)
            AND Id NOT IN (SELECT AssetId FROM Case WHERE AssetId != null)
            AND Status = 'Installed'
            LIMIT 1
        ];
        return assets.isEmpty() ? null : assets[0];
    }

    private static Asset getExpiredWarrantyAsset() {
        List<Asset> assets = [
            SELECT Id, Name, Entitlement_Status__c
            FROM Asset
            WHERE Entitlement_Status__c = 'Expired'
            AND Status = 'Installed'
            LIMIT 1
        ];
        return assets.isEmpty() ? null : assets[0];
    }

    private static Asset getAnyAsset() {
        return [SELECT Id, Name FROM Asset WHERE Status = 'Installed' LIMIT 1];
    }

    @IsTest
    static void testGetHealthScore_AssetWithWorkOrders() {
        Asset a = getAssetWithWorkOrders();
        if (a == null) {
            a = getAnyAsset();
        }

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.overallScore >= 0 && result.overallScore <= 100,
            'Score should be 0-100, got: ' + result.overallScore);
        System.assertNotEquals(null, result.scoreLabel, 'Score label should be set');
        System.assertNotEquals(null, result.assetName, 'Asset name should be set');
        System.assertNotEquals(null, result.lastCalculated, 'Last calculated should be set');

        // Factors
        System.assertEquals(3, result.factors.size(), 'Should have 3 factors');
        for (AssetHealthScoreController.FactorDetail f : result.factors) {
            System.assert(f.score >= 0 && f.score <= 100,
                'Factor score should be 0-100, got: ' + f.score + ' for ' + f.name);
            System.assertNotEquals(null, f.status, 'Factor status should be set');
            System.assertNotEquals(null, f.detail, 'Factor detail should be set');
            System.assert(f.weight > 0, 'Factor weight should be positive');
        }

        // Trend
        System.assertEquals(6, result.trendData.size(), 'Should have 6 trend points');
        for (AssetHealthScoreController.TrendPoint tp : result.trendData) {
            System.assertNotEquals(null, tp.month, 'Month label should be set');
            System.assert(tp.score >= 0 && tp.score <= 100,
                'Trend score should be 0-100, got: ' + tp.score);
        }

        // Metrics
        System.assertNotEquals(null, result.metrics, 'Metrics should not be null');
        System.assertEquals(6, result.metrics.size(), 'Should have 6 metrics');
        for (AssetHealthScoreController.AssetMetric m : result.metrics) {
            System.assertNotEquals(null, m.label, 'Metric label should be set');
            System.assertNotEquals(null, m.value, 'Metric value should be set');
            System.assertNotEquals(null, m.icon, 'Metric icon should be set');
        }

        // Recommendation
        System.assertNotEquals(null, result.recommendation, 'Recommendation should not be null');
        System.assertNotEquals(null, result.recommendation.title, 'Title should be set');
        System.assertNotEquals(null, result.recommendation.description, 'Description should be set');
        System.assertNotEquals(null, result.recommendation.actionLabel, 'Action label should be set');
    }

    @IsTest
    static void testGetHealthScore_CleanAsset() {
        Asset a = getAssetWithoutWorkOrders();
        if (a == null) {
            // Fallback: just use any asset
            a = getAnyAsset();
        }

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.overallScore >= 0 && result.overallScore <= 100,
            'Score should be valid, got: ' + result.overallScore);
    }

    @IsTest
    static void testGetHealthScore_ExpiredWarranty() {
        Asset a = getExpiredWarrantyAsset();
        if (a == null) {
            a = getAnyAsset();
        }

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');

        AssetHealthScoreController.FactorDetail warrantyFactor;
        for (AssetHealthScoreController.FactorDetail f : result.factors) {
            if (f.name == 'Warranty Status') {
                warrantyFactor = f;
                break;
            }
        }
        System.assertNotEquals(null, warrantyFactor, 'Warranty factor should exist');
        // If we got an actual expired asset, verify low score
        if (a.Entitlement_Status__c == 'Expired') {
            System.assert(warrantyFactor.score <= 50,
                'Expired warranty should score low, got: ' + warrantyFactor.score);
        }
    }

    @IsTest
    static void testScoreLabels() {
        Asset a = getAnyAsset();

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        String label = result.scoreLabel;
        System.assert(
            label == 'Excellent' || label == 'Good' || label == 'Fair' ||
            label == 'At Risk' || label == 'Critical',
            'Label should be a valid category, got: ' + label
        );
    }

    @IsTest
    static void testTrendDataCompleteness() {
        Asset a = getAnyAsset();

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        List<AssetHealthScoreController.TrendPoint> trend = result.trendData;
        System.assertEquals(6, trend.size(), 'Should have 6 trend points');

        // Last trend point should match current score
        AssetHealthScoreController.TrendPoint lastPoint = trend[trend.size() - 1];
        System.assertEquals(result.overallScore, lastPoint.score,
            'Last trend point should match current score');
    }

    @IsTest
    static void testFactorWeightsAddUp() {
        Asset a = getAnyAsset();

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        Integer totalWeight = 0;
        for (AssetHealthScoreController.FactorDetail f : result.factors) {
            totalWeight += f.weight;
        }
        System.assertEquals(100, totalWeight, 'Factor weights should sum to 100');
    }

    @IsTest
    static void testMetricsContent() {
        Asset a = getAnyAsset();

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        // Verify specific metric labels exist
        Set<String> expectedLabels = new Set<String>{
            'Age', 'Days Since Installation', 'Total Usage',
            'Hours', 'Repairs', 'Repairs in Last 6 Months'
        };
        for (AssetHealthScoreController.AssetMetric m : result.metrics) {
            System.assert(expectedLabels.contains(m.label),
                'Unexpected metric label: ' + m.label);
        }
    }
}
