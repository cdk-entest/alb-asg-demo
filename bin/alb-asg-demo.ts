#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  VpcStack,
  ApplicationStack,
} from "../lib/alb-asg-demo-stack";

const app = new cdk.App();

// vpc stack
const vpc = new VpcStack(app, "AlbAsgDemoStack", {
  env: {
    region: "us-east-1",
  },
});

// application stack
new ApplicationStack(app, "ApplicationStack", {
  vpc: vpc.vpc,
  env: {
    region: "us-east-1",
  },
});

