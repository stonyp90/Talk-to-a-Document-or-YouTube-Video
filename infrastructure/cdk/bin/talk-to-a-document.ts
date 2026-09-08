#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TalkToADocumentStack } from '../lib/talk-to-a-document-stack';
import { BootstrapStack } from '../lib/bootstrap-stack';

const app = new cdk.App();
const StackType = app.node.tryGetContext('bootstrap') === 'true' ? BootstrapStack : TalkToADocumentStack;
new StackType(app, StackType === BootstrapStack ? 'TalkToADocumentBootstrap' : 'TalkToADocumentStack', {
  synthesizer: new cdk.BootstraplessSynthesizer(),
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  },
});
