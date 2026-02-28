@IsTest
private class AssetHealthScoreControllerTest {

    @TestSetup
    static void setupTestData() {
        Account acc = new Account(Name = 'Test Account');
        insert acc;

        Product2 prod = new Product2(Name = 'Test Turbine', ProductCode = 'TURB-001', IsActive = true);
        insert prod;

        // Asset with related data
        Asset fullAsset = new Asset(
            Name = 'Test Turbine Alpha',
            AccountId = acc.Id,
            Product2Id = prod.Id,
            Status = 'Installed',
            InstallDate = Date.today().addDays(-365),
            Entitlement_Status__c = 'Active'
        );
        insert fullAsset;

        // Asset with no related records
        Asset cleanAsset = new Asset(
            Name = 'Test Turbine Clean',
            AccountId = acc.Id,
            Product2Id = prod.Id,
            Status = 'Installed',
            InstallDate = Date.today().addDays(-30)
        );
        insert cleanAsset;

        // Asset with expired warranty
        Asset expiredAsset = new Asset(
            Name = 'Test Turbine Expired',
            AccountId = acc.Id,
            Status = 'Installed',
            InstallDate = Date.today().addDays(-730),
            Entitlement_Status__c = 'Expired'
        );
        insert expiredAsset;

        // Cases for fullAsset
        List<Case> cases = new List<Case>();
        cases.add(new Case(
            AssetId = fullAsset.Id,
            Subject = 'Overheating reported',
            Status = 'New',
            Priority = 'High',
            Origin = 'Phone'
        ));
        cases.add(new Case(
            AssetId = fullAsset.Id,
            Subject = 'Noise complaint',
            Status = 'Closed',
            Priority = 'Medium',
            Origin = 'Email'
        ));
        cases.add(new Case(
            AssetId = fullAsset.Id,
            Subject = 'Escalated vibration issue',
            Status = 'New',
            Priority = 'Critical',
            IsEscalated = true,
            Origin = 'Web'
        ));
        insert cases;
    }

    @IsTest
    static void testGetHealthScore_FullAsset() {
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Alpha' LIMIT 1];

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.overallScore >= 0 && result.overallScore <= 100,
            'Score should be 0-100, got: ' + result.overallScore);
        System.assertNotEquals(null, result.scoreLabel, 'Score label should be set');
        System.assertEquals('Test Turbine Alpha', result.assetName, 'Asset name should match');
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
        System.assertEquals(a.Id, result.recommendation.assetId, 'Asset ID should match');
    }

    @IsTest
    static void testGetHealthScore_CleanAsset() {
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Clean' LIMIT 1];

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assert(result.overallScore >= 50,
            'Clean asset should score well, got: ' + result.overallScore);
    }

    @IsTest
    static void testGetHealthScore_ExpiredWarranty() {
        Asset a = [SELECT Id, Entitlement_Status__c FROM Asset WHERE Name = 'Test Turbine Expired' LIMIT 1];

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
        System.assert(warrantyFactor.score <= 50,
            'Expired warranty should score low, got: ' + warrantyFactor.score);
    }

    @IsTest
    static void testScoreLabels() {
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Clean' LIMIT 1];

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
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Alpha' LIMIT 1];

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        List<AssetHealthScoreController.TrendPoint> trend = result.trendData;
        System.assertEquals(6, trend.size(), 'Should have 6 trend points');
        AssetHealthScoreController.TrendPoint lastPoint = trend[trend.size() - 1];
        System.assertEquals(result.overallScore, lastPoint.score,
            'Last trend point should match current score');
    }

    @IsTest
    static void testFactorWeightsAddUp() {
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Alpha' LIMIT 1];

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
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Alpha' LIMIT 1];

        Test.startTest();
        AssetHealthScoreController.HealthScoreResult result =
            AssetHealthScoreController.getHealthScore(a.Id);
        Test.stopTest();

        Set<String> expectedLabels = new Set<String>{
            'Age', 'Days Since Installation', 'Total Usage',
            'Hours', 'Repairs', 'Repairs in Last 6 Months'
        };
        for (AssetHealthScoreController.AssetMetric m : result.metrics) {
            System.assert(expectedLabels.contains(m.label),
                'Unexpected metric label: ' + m.label);
        }
    }

    @IsTest
    static void testResolveAssetId_Asset() {
        Asset a = [SELECT Id FROM Asset WHERE Name = 'Test Turbine Alpha' LIMIT 1];

        Test.startTest();
        Id resolved = AssetHealthScoreController.resolveAssetId(a.Id);
        Test.stopTest();

        System.assertEquals(a.Id, resolved, 'Should return same Asset Id');
    }
}
