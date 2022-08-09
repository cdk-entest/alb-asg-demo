#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  VpcStack,
  ApplicationStack,
} from "../lib/alb-asg-demo-stack";

const app = new cdk.App();

// vpc stack
const vpc = new VpcStack(app, "AlbAsgDemoStack", {
  cidr: "10.1.0.0/20",
  env: {
    region: "us-east-1",
  },
});

// application stack
const alb = new ApplicationStack(app, "ApplicationStack", {
  vpc: vpc.vpc,
  env: {
    region: "us-east-1",
  },
});

alb.addDependency(vpc);
