import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

/** Deploy once with an operator identity; never expose bootstrap mutations to CI. */
export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const repository = this.node.tryGetContext('githubRepository');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('githubRepository must be OWNER/REPO');
    const secretArn = this.node.tryGetContext('openAiSecretArn') ?? process.env.OPENAI_SECRET_ARN;
    if (!secretArn || !secretArn.startsWith('arn:')) throw new Error('An exact openAiSecretArn is required');
    const arn = (service: string, resource: string, region = this.region) => `arn:${this.partition}:${service}:${region}:${this.account}:${resource}`;
    const runtimeArn = arn('iam', 'role/talk-to-a-document-runtime', '');
    const runtimeArns = [runtimeArn, arn('iam', 'role/talk-to-a-document-transcript-runtime', '')];
    const functionArn = arn('lambda', 'function:talk-to-a-document-api');
    const transcriptArn = arn('lambda', 'function:talk-to-a-document-transcript');
    const bucketArn = `arn:${this.partition}:s3:::talk-to-a-document-uploads-${this.account}-${this.region}`;
    const logArn = arn('logs', 'log-group:/aws/lambda/talk-to-a-document-api');
    const transcriptLogArn = arn('logs', 'log-group:/aws/lambda/talk-to-a-document-transcript');
    const boundary = new iam.ManagedPolicy(this, 'RuntimeBoundary', {
      managedPolicyName: 'talk-to-a-document-runtime-boundary',
      statements: [
        new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'], resources: [`${bucketArn}/uploads/*`] }),
        new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], resources: [secretArn] }),
        new iam.PolicyStatement({ actions: ['logs:CreateLogStream', 'logs:PutLogEvents'], resources: [`${logArn}:*`, `${transcriptLogArn}:*`] }),
      ],
    });
    const execution = new iam.Role(this, 'CloudFormationRole', {
      roleName: 'talk-to-a-document-cloudformation',
      assumedBy: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
    });
    const grant = (actions: string[], resources: string[], conditions?: Record<string, Record<string, string>>) => execution.addToPolicy(new iam.PolicyStatement({ actions, resources, conditions }));
    grant(['lambda:CreateFunction', 'lambda:DeleteFunction', 'lambda:GetFunction', 'lambda:GetFunctionConfiguration', 'lambda:UpdateFunctionCode', 'lambda:UpdateFunctionConfiguration', 'lambda:AddPermission', 'lambda:RemovePermission', 'lambda:GetPolicy', 'lambda:TagResource', 'lambda:UntagResource', 'lambda:ListTags'], [functionArn, transcriptArn]);
    grant(['lambda:PutFunctionConcurrency', 'lambda:DeleteFunctionConcurrency', 'lambda:GetFunctionConcurrency'], [functionArn, transcriptArn]);
    grant(['s3:CreateBucket', 's3:DeleteBucket', 's3:GetBucketLocation', 's3:ListBucket', 's3:GetBucketPolicy', 's3:PutBucketPolicy', 's3:DeleteBucketPolicy', 's3:GetBucketPublicAccessBlock', 's3:PutBucketPublicAccessBlock', 's3:GetEncryptionConfiguration', 's3:PutEncryptionConfiguration', 's3:GetLifecycleConfiguration', 's3:PutLifecycleConfiguration', 's3:GetBucketCORS', 's3:PutBucketCORS', 's3:GetBucketTagging', 's3:PutBucketTagging', 's3:GetBucketVersioning', 's3:GetBucketObjectLockConfiguration', 's3:GetBucketOwnershipControls', 's3:PutBucketOwnershipControls'], [bucketArn]);
    grant(['logs:CreateLogGroup', 'logs:DeleteLogGroup', 'logs:PutRetentionPolicy', 'logs:DeleteRetentionPolicy', 'logs:TagResource', 'logs:UntagResource', 'logs:ListTagsForResource'], [logArn, `${logArn}:*`, transcriptLogArn, `${transcriptLogArn}:*`]);
    // DescribeLogGroups has no resource-level authorization in CloudWatch Logs.
    grant(['logs:DescribeLogGroups'], ['*']);
    // API IDs are allocated at creation; bounded to HTTP API resources in this region.
    grant(['apigateway:GET', 'apigateway:POST', 'apigateway:PUT', 'apigateway:PATCH', 'apigateway:DELETE'], [`arn:${this.partition}:apigateway:${this.region}::/apis`, `arn:${this.partition}:apigateway:${this.region}::/apis/*`, `arn:${this.partition}:apigateway:${this.region}::/tags/*`]);
    grant(['iam:CreateRole', 'iam:PutRolePermissionsBoundary'], runtimeArns, { StringEquals: { 'iam:PermissionsBoundary': boundary.managedPolicyArn } });
    grant(['iam:GetRole', 'iam:DeleteRole', 'iam:UpdateAssumeRolePolicy', 'iam:PutRolePolicy', 'iam:GetRolePolicy', 'iam:DeleteRolePolicy', 'iam:ListRolePolicies', 'iam:ListAttachedRolePolicies', 'iam:TagRole', 'iam:UntagRole'], runtimeArns);
    grant(['iam:PassRole'], runtimeArns, { StringEquals: { 'iam:PassedToService': 'lambda.amazonaws.com' } });
    const registry = new ecr.Repository(this, 'Repository', {
      repositoryName: 'talk-to-a-document-api',
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    registry.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
      actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      conditions: { StringEquals: { 'aws:SourceAccount': this.account }, ArnLike: { 'aws:SourceArn': functionArn } },
    }));
    grant(['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer', 'ecr:GetRepositoryPolicy'], [registry.repositoryArn]);
    const transcriptRegistry = new ecr.Repository(this, 'TranscriptRepository', {
      repositoryName: 'talk-to-a-document-transcript', imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true, removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    transcriptRegistry.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('lambda.amazonaws.com')], actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      conditions: { StringEquals: { 'aws:SourceAccount': this.account }, ArnLike: { 'aws:SourceArn': transcriptArn } },
    }));
    grant(['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer', 'ecr:GetRepositoryPolicy'], [transcriptRegistry.repositoryArn]);
    const providerArn = this.node.tryGetContext('oidcProviderArn');
    const resolvedProviderArn = providerArn ?? new iam.CfnOIDCProvider(this, 'GitHubProvider', {
      url: 'https://token.actions.githubusercontent.com', clientIdList: ['sts.amazonaws.com'],
    }).ref;
    const deploy = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'talk-to-a-document-github',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.FederatedPrincipal(resolvedProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${repository}:environment:production`,
        },
      }, 'sts:AssumeRoleWithWebIdentity'),
    });
    deploy.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    deploy.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:DescribeImages', 'ecr:BatchCheckLayerAvailability', 'ecr:InitiateLayerUpload', 'ecr:UploadLayerPart', 'ecr:CompleteLayerUpload', 'ecr:PutImage', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'], resources: [registry.repositoryArn, transcriptRegistry.repositoryArn] }));
    deploy.addToPolicy(new iam.PolicyStatement({ actions: ['cloudformation:CreateChangeSet', 'cloudformation:DescribeChangeSet', 'cloudformation:ExecuteChangeSet', 'cloudformation:DeleteChangeSet', 'cloudformation:DescribeStacks', 'cloudformation:DescribeStackEvents', 'cloudformation:GetTemplate'], resources: [arn('cloudformation', 'stack/TalkToADocumentStack/*')] }));
    deploy.addToPolicy(new iam.PolicyStatement({ actions: ['iam:PassRole'], resources: [execution.roleArn], conditions: { StringEquals: { 'iam:PassedToService': 'cloudformation.amazonaws.com' } } }));
    new cdk.CfnOutput(this, 'GitHubRoleArn', { value: deploy.roleArn });
    new cdk.CfnOutput(this, 'CloudFormationRoleArn', { value: execution.roleArn });
  }
}
