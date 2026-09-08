import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';

/** No CDK assets or custom resources: deploy the synthesized template directly. */
export class TalkToADocumentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = ecr.Repository.fromRepositoryName(this, 'ApiRepository', process.env.ECR_REPOSITORY ?? 'talk-to-a-document-api');
    new cdk.CfnOutput(this, 'ApiRepositoryUri', { value: repository.repositoryUri });

    const executionRole = new iam.Role(this, 'ApiExecutionRole', {
      roleName: 'talk-to-a-document-runtime',
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyName(this, 'RuntimeBoundary', 'talk-to-a-document-runtime-boundary'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: '/aws/lambda/talk-to-a-document-api',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    logGroup.grantWrite(executionRole);
    const origin = process.env.APP_ORIGIN || this.node.tryGetContext('appOrigin') || 'http://localhost:3000';
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'talk-to-a-document-api',
      corsPreflight: {
        allowHeaders: ['content-type'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: [origin],
      },
    });

    const uploads = new s3.Bucket(this, 'TemporaryUploads', {
      bucketName: `talk-to-a-document-uploads-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(1) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{ allowedOrigins: [httpApi.apiEndpoint, origin], allowedMethods: [s3.HttpMethods.POST], allowedHeaders: ['*'], exposedHeaders: ['ETag'], maxAge: 300 }],
    });

    const secretArn = process.env.OPENAI_SECRET_ARN ?? this.node.tryGetContext('openAiSecretArn');
    const openAiSecret = secretArn
      ? secretsmanager.Secret.fromSecretCompleteArn(this, 'OpenAiSecret', secretArn)
      : secretsmanager.Secret.fromSecretNameV2(this, 'OpenAiSecret', 'talk-to-a-document/openai');
    const imageTag = this.node.tryGetContext('imageTag') ?? process.env.IMAGE_TAG;
    if (!/^[a-f0-9]{40}$/.test(imageTag ?? '')) throw new Error('imageTag must be the full CI-tested Git commit SHA');
    const providerMode = process.env.PROVIDER_MODE ?? this.node.tryGetContext('providerMode') ?? 'live';

    const transcriptLogs = new logs.LogGroup(this, 'TranscriptLogs', {
      logGroupName: '/aws/lambda/talk-to-a-document-transcript',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const transcriptRole = new iam.Role(this, 'TranscriptRole', {
      roleName: 'talk-to-a-document-transcript-runtime',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyName(this, 'TranscriptBoundary', 'talk-to-a-document-runtime-boundary'),
    });
    transcriptLogs.grantWrite(transcriptRole);
    const transcript = new lambda.DockerImageFunction(this, 'TranscriptFunction', {
      functionName: 'talk-to-a-document-transcript',
      code: lambda.DockerImageCode.fromEcr(ecr.Repository.fromRepositoryName(this, 'TranscriptRepository', 'talk-to-a-document-transcript'), { tagOrDigest: imageTag }),
      role: transcriptRole,
      logGroup: transcriptLogs,
      memorySize: 256,
      reservedConcurrentExecutions: 2,
      timeout: cdk.Duration.seconds(20),
      architecture: lambda.Architecture.X86_64,
      environment: { PORT: '3010', TRANSCRIPT_MODE: 'live', UPSTREAM_TIMEOUT_SECONDS: '10' },
    });
    httpApi.addRoutes({ path: '/transcript/{videoId}', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('TranscriptIntegration', transcript) });

    const apiFunction = new lambda.DockerImageFunction(this, 'ApiFunction', {
      functionName: 'talk-to-a-document-api',
      logGroup,
      code: lambda.DockerImageCode.fromEcr(repository, { tagOrDigest: imageTag }),
      role: executionRole,
      memorySize: 1024,
      reservedConcurrentExecutions: 5,
      timeout: cdk.Duration.seconds(28),
      architecture: lambda.Architecture.X86_64,
      environment: {
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
        PROVIDER_MODE: providerMode,
        OPENAI_SECRET_ARN: openAiSecret.secretArn,
        UPLOAD_BUCKET: uploads.bucketName,
        APP_ORIGIN: process.env.APP_ORIGIN || httpApi.apiEndpoint,
        YOUTUBE_TRANSCRIPT_MODE: 'live',
        TRANSCRIPT_SERVICE_URL: httpApi.apiEndpoint,
        OPENAI_BASE_URL: 'https://api.openai.com',
        OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
        OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini',
      },
    });
    executionRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'], resources: [uploads.arnForObjects('uploads/*')] }));
    openAiSecret.grantRead(apiFunction);

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('ApiIntegration', apiFunction),
    });
    httpApi.addRoutes({
      path: '/',
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('RootIntegration', apiFunction),
    });

    const stage = httpApi.defaultStage!.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 20, throttlingRateLimit: 10 };
    const paidRoutes = ['/api/realtime/session', '/api/realtime/connect', '/api/text-chat', '/api/uploads'];
    stage.routeSettings = Object.fromEntries(paidRoutes.map(path => [`POST ${path}`, { ThrottlingBurstLimit: 2, ThrottlingRateLimit: 1 }]));
    for (const path of paidRoutes) {
      const routes = httpApi.addRoutes({ path, methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration(`Paid${path.replaceAll('/', '-')}`, apiFunction) });
      for (const route of routes) stage.addDependency(route.node.defaultChild as apigwv2.CfnRoute);
    }

    new cdk.CfnOutput(this, 'ApiExecutionRoleArn', { value: executionRole.roleArn });
    new cdk.CfnOutput(this, 'ApiFunctionName', { value: apiFunction.functionName });
    new cdk.CfnOutput(this, 'PublicUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'TemporaryUploadBucket', { value: uploads.bucketName });
  }
}
