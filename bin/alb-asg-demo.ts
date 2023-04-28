#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  VpcStack,
  ApplicationStack,
} from "../lib/alb-asg-demo-stack";
import {
  NetworkStack,
  WebServerStack,
} from "../test/hello";

const app = new cdk.App();

// // vpc stack
// const vpc = new VpcStack(app, "VpcStack", {
//   cidr: "10.1.0.0/20",
//   env: {
//     region: "us-east-1",
//   },
// });

// // application stack
// const alb = new ApplicationStack(app, "ApplicationStack", {
//   vpc: vpc.vpc,
//   env: {
//     region: "us-east-1",
//   },
// });

// alb.addDependency(vpc);

//
const net = new NetworkStack(app, "NetworkStack", {
  env: {
    region: "us-east-1",
  },
});

const web = new WebServerStack(app, "WebServerStack", {
  vpc: net.vpc,
  env: {
    region: "us-east-1",
  },
});
