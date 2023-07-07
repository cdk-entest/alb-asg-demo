#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  VpcStack,
  ApplicationStack,
  ImportedVpcStack,
  WebServerStack,
} from "../lib/alb-asg-demo-stack";

// deployment mode
const DEPLOY_MODE: string = "newnetwork";
// region
const REGION: string = "ap-southeast-1";
// cidr block
const CIDR = "10.0.0.0/16";

const app = new cdk.App();

// look up existed vpc
if (DEPLOY_MODE == "existedVpc") {
  const network = new ImportedVpcStack(app, "LookupExistedVpc", {
    vpcName: "VpcForRdsEc2",
    vpcId: "vpc-049d70b38566687a6",
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  new ApplicationStack(app, "ApplicationStack", {
    vpc: network.vpc,
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });
} else {
  // new vpc stack
  const network = new VpcStack(app, "VpcStack", {
    cidr: CIDR,
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  // application stack
  const alb = new ApplicationStack(app, "ApplicationStack", {
    vpc: network.vpc,
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  // polly webserver
  const webserver = new WebServerStack(app, "WebServerPollyStack", {
    vpc: network.vpc,
    env: {
      region: REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  });

  alb.addDependency(network);
  webserver.addDependency(network);
}
