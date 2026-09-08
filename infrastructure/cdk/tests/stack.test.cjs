const { test } = require('node:test');
const assert = require('node:assert/strict');
const cdk = require('aws-cdk-lib');
const { Template, Match } = require('aws-cdk-lib/assertions');
const { TalkToADocumentStack } = require('../lib/talk-to-a-document-stack');
const sha = 'a'.repeat(40);
function template() {
  const app = new cdk.App({ context: { imageTag: sha } });
  return Template.fromStack(new TalkToADocumentStack(app, 'Test', { env: { account: '123456789012', region: 'us-east-1' } }));
}
test('requires an immutable full tested commit', () => {
  assert.throws(() => new TalkToADocumentStack(new cdk.App(), 'Invalid'), /CI-tested/);
});
test('uses the tested ECR tag and bounded Lambda timeout', () => {
  template().hasResourceProperties('AWS::Lambda::Function', {
    Timeout: 28, PackageType: 'Image', Architectures: ['x86_64'],
    Code: { ImageUri: Match.anyValue() },
    Environment: { Variables: Match.objectLike({ UPLOAD_BUCKET: Match.anyValue(), YOUTUBE_TRANSCRIPT_MODE: 'live' }) },
  });
  assert.ok(JSON.stringify(template().toJSON()).includes(sha));
});
test('allows direct browser POST only from configured origin, retains bucket', () => {
  template().hasResource('AWS::S3::Bucket', {
    DeletionPolicy: 'Retain',
    Properties: Match.objectLike({
      CorsConfiguration: { CorsRules: [Match.objectLike({ AllowedMethods: ['POST'], AllowedOrigins: [Match.anyValue(), 'http://localhost:3000'] })] },
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    }),
  });
});
test('has no custom-resource deployment backdoor or CDK assets', () => {
  const resources = Object.values(template().toJSON().Resources);
  assert.ok(resources.every(r => !r.Type.startsWith('Custom::')));
  assert.equal(resources.filter(r => r.Type === 'AWS::Lambda::Function').length, 2);
});
test('anonymous endpoints have coarse throttles and bounded concurrency', () => {
  template().hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    StageName: '$default',
    DefaultRouteSettings: { ThrottlingBurstLimit: 20, ThrottlingRateLimit: 10 },
    RouteSettings: Match.objectLike({
      'POST /api/realtime/session': { ThrottlingBurstLimit: 2, ThrottlingRateLimit: 1 },
      'POST /api/text-chat': { ThrottlingBurstLimit: 2, ThrottlingRateLimit: 1 },
    }),
  });
  template().hasResourceProperties('AWS::Lambda::Function', { FunctionName: 'talk-to-a-document-api', ReservedConcurrentExecutions: 5 });
  template().hasResourceProperties('AWS::Lambda::Function', { FunctionName: 'talk-to-a-document-transcript', ReservedConcurrentExecutions: 2 });
});
