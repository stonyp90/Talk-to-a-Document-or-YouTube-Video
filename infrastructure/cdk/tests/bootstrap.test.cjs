const { test } = require('node:test');
const assert = require('node:assert/strict');
const cdk = require('aws-cdk-lib');
const { Template, Match } = require('aws-cdk-lib/assertions');
const { BootstrapStack } = require('../lib/bootstrap-stack');
function template() {
  const app = new cdk.App({ context: {
    githubRepository: 'example/talk',
    openAiSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:talk-test-abcdef',
  } });
  return Template.fromStack(new BootstrapStack(app, 'Bootstrap', { env: { account: '123456789012', region: 'us-east-1' } }));
}
test('OIDC trust binds exact repository, production environment, audience', () => {
  template().hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'talk-to-a-document-github',
    AssumeRolePolicyDocument: Match.objectLike({ Statement: [Match.objectLike({
      Action: 'sts:AssumeRoleWithWebIdentity',
      Condition: { StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        'token.actions.githubusercontent.com:sub': 'repo:example/talk:environment:production',
      } },
    })] }),
  });
});
test('both ECR repositories require immutable tags', () => {
  const repositories = Object.values(template().toJSON().Resources).filter(r => r.Type === 'AWS::ECR::Repository');
  assert.equal(repositories.length, 2);
  assert.ok(repositories.every(r => r.Properties.ImageTagMutability === 'IMMUTABLE'));
});
test('no administrator grants; only unavoidable actions use wildcard resources', () => {
  const statements = Object.values(template().toJSON().Resources)
    .filter(r => ['AWS::IAM::Policy', 'AWS::IAM::ManagedPolicy'].includes(r.Type))
    .flatMap(r => r.Properties.PolicyDocument.Statement);
  for (const statement of statements) {
    const actions = [].concat(statement.Action);
    assert.ok(actions.every(action => !action.includes('*')));
    if ([].concat(statement.Resource).includes('*')) {
      assert.ok(actions.every(action => ['ecr:GetAuthorizationToken', 'logs:DescribeLogGroups'].includes(action)));
    }
  }
  assert.ok(JSON.stringify(statements).includes('iam:PermissionsBoundary'));
  assert.ok(!JSON.stringify(statements).includes('iam:DeleteRolePermissionsBoundary'));
});
test('invalid or wildcard repository cannot be trusted', () => {
  assert.throws(() => new BootstrapStack(new cdk.App({ context: { githubRepository: 'example/*' } }), 'Invalid'), /OWNER\/REPO/);
});
test('bootstrap uses native OIDC with no custom Lambda or assets', () => {
  template().resourceCountIs('AWS::IAM::OIDCProvider', 1);
  template().resourceCountIs('AWS::Lambda::Function', 0);
  assert.ok(Object.values(template().toJSON().Resources).every(r => !r.Type.startsWith('Custom::')));
});
