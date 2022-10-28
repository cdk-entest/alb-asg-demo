---
title: Application Load Balancer and Auto Scaling Group
description: a simple alb and asg web application
author: haimtran
publishedDate: 09/06/2022
date: 2022-08-09
---


## Application Load Balander and Auto Scaling Group

- Create a VPC 
- Create a application load balancer 
- Create an autoscaling group (asg) 2-2-2
- Add userData to run a web 
- Terminate an EC2 and see (asg) launch a new EC2
- [GitHub](https://github.com/entest-hai/alb-asg-demo)

![architect](https://user-images.githubusercontent.com/20411077/198505677-6caeb0c2-ffbd-4eb8-aca3-525805c00a6b.png)


## VPC Stack 
```tsx
export class VpcStack extends Stack {
  public readonly vpc: aws_ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id, props);

    this.vpc = new aws_ec2.Vpc(this, "VpcAlbDemo", {
      vpcName: "VpcAlbDemo",
      cidr: props.cidr,
      subnetConfiguration: [
        {
          name: "Public",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        {
          name: "PrivateWithNat",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        {
          name: "PrivateWoNat",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
```

## Application Load Balancer 
security group for alb 
 ```tsx
 const albSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "SGForWeb",
      {
        securityGroupName: "SGForWeb",
        vpc: vpc,
      }
    );

    albSecurityGroup.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80),
      "Allow port 80 web"
    );
 ```
 application load balancer 
 ```tsx
 const alb =
      new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
        this,
        "AlbWebDemo",
        {
          vpc: vpc,
          loadBalancerName: "AlbWebDemo",
          vpcSubnets: {
            subnetType: aws_ec2.SubnetType.PUBLIC,
          },
          internetFacing: true,
          deletionProtection: false,
          securityGroup: albSecurityGroup,
        }
      );
 ```
add listener port 80
```tsx
 const listener = alb.addListener("AlbListener", {
      port: 80,
    });
```

## Auto Scaling Group 
security group for auto scaling group 
```tsx
 const asgSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "SGForASG",
      {
        securityGroupName: "SGForASG",
        vpc: props.vpc,
      }
    );

    asgSecurityGroup.addIngressRule(
      aws_ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      aws_ec2.Port.tcp(80)
    );
```
auto scaling group 
```tsx
 const asg = new aws_autoscaling.AutoScalingGroup(
      this,
      "AsgDemo",
      {
        autoScalingGroupName: "AsgWebDemo",
        vpc: vpc,
        instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.T2,
          aws_ec2.InstanceSize.SMALL
        ),
        machineImage: new aws_ec2.AmazonLinuxImage({
          generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          edition: aws_ec2.AmazonLinuxEdition.STANDARD,
        }),
        minCapacity: 2,
        maxCapacity: 2,
        vpcSubnets: {
          subnets: vpc.privateSubnets,
        },
        role: role,
        securityGroup: asgSecurityGroup,
      }
    );
```
asg user data - download and run webserver 
```tsx
 asg.addUserData(
      fs.readFileSync("./lib/script/user-data.sh", "utf8")
    );
```

## Integrate ALB with ASG
an implicit target group created 
```tsx

    listener.addTargets("Target", {
      port: 80,
      targets: [asg],
      healthCheck: {
        path: "/",
        port: "80",
        protocol: aws_elasticloadbalancingv2.Protocol.HTTP,
        healthyThresholdCount: 5,
        unhealthyThresholdCount: 2,
        timeout: Duration.seconds(10),
      },
    });
```


## AutoScaling Strategies 

target tracking - on cpu usage 
```tsx
asg.scaleOnCpuUtilization("KeepSparseCPU", {
  targetUtilizationPercent: 50,
});
```

target tracking - on number of request per instance 
```tsx
asg.scaleOnRequestCount("AvgReqeustPerInstance", {
  targetRequestsPerMinute: 1000,
});
```

step scale - based on custom metric 
```tsx 
const metric = new aws_cloudwatch.Metric({
      metricName: "CPUUtilization",
      namespace: "AWS/EC2",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asg.autoScalingGroupName,
      },
    });
```

scale on custom metric with custom step  
```tsx 
asg.scaleOnMetric("MyMetric", {
  metric: metric,
  scalingSteps: [
    {
      upper: 1,
      change: -1,
    },
    {
      lower: 10,
      change: +1,
    },
    {
      lower: 60,
      change: +3,
    },
  ],
  adjustmentType:
    aws_autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
});
```

## Test 
Option 1. manually terminal EC2 instances 
Option 2. send concurrent requests 
```py
import time
import requests
from concurrent.futures import ThreadPoolExecutor

URL = "http://$ALB_URL"
NO_CONCUR_REQUEST = 1000
COUNT = 1


def send_request():
    resp = requests.get(URL)
    # print(resp)


def test_concurrent():
    with ThreadPoolExecutor(max_workers=NO_CONCUR_REQUEST) as executor:
        for k in range(1, NO_CONCUR_REQUEST):
            executor.submit(send_request)


while True:
    print(f"{NO_CONCUR_REQUEST} requests {COUNT}")
    test_concurrent()
    time.sleep(1)
    COUNT += 1
```

## UserData 
```bash 
#!/bin/bash
cd ~
wget https://github.com/cdk-entest/alb-asg-demo/archive/refs/heads/main.zip 
unzip main.zip
cd alb-asg-demo-main
cd web
python3 -m pip install -r requirements.txt
python3 -m app
```
