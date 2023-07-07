import {
  aws_autoscaling,
  aws_ec2,
  aws_elasticloadbalancingv2,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";

export class NetworkStack extends Stack {
  public readonly vpc: aws_ec2.Vpc;
  constructor(
    scope: Construct,
    id: string,
    props: StackProps
  ) {
    super(scope, id, props);

    // vpc
    this.vpc = new aws_ec2.Vpc(this, "VpcDemo", {
      // default igw, route table, nat in pub-subnet
      vpcName: "DemoVpc",
      cidr: "10.1.0.0/20",
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        {
          name: "private-nat",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
        },
      ],
    });
  }
}

interface WebServerProps extends StackProps {
  vpc: aws_ec2.Vpc;
}

export class WebServerStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: WebServerProps
  ) {
    super(scope, id, props);

    // security group for webserver
    const webServerSecurityGroup =
      new aws_ec2.SecurityGroup(
        this,
        "WebServerSecurityGroup",
        {
          securityGroupName: "WebServerSecurityGroup",
          vpc: props.vpc,
        }
      );
    webServerSecurityGroup.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80)
    );

    // ec2 public ip
    const pubEc2 = new aws_ec2.Instance(
      this,
      "WebServerEc2",
      {
        instanceName: "WebServerEc2",
        vpc: props.vpc,
        securityGroup: webServerSecurityGroup,
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.T2,
          aws_ec2.InstanceSize.SMALL
        ),
        machineImage: new aws_ec2.AmazonLinuxImage({
          generation:
            aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          edition: aws_ec2.AmazonLinuxEdition.STANDARD,
        }),
      }
    );

    pubEc2.addUserData(
      fs.readFileSync("./lib/script/user-data.sh", "utf8")
    );

    // alb security group
    const albSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "AlbSecurityGroup",
      {
        securityGroupName: "AlbSecurityGroup",
        vpc: props.vpc,
      }
    );
    albSecurityGroup.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80)
    );

    // application load balancer
    const alb =
      new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
        this,
        "AlbDemo",
        {
          vpc: props.vpc,
          loadBalancerName: "AlbDemo",
          vpcSubnets: {
            subnetType: aws_ec2.SubnetType.PUBLIC,
          },
          internetFacing: true,
          deletionProtection: false,
          securityGroup: albSecurityGroup,
        }
      );

    // listener port 80 HTTP
    const listener = alb.addListener("AlbListenderPort80", {
      port: 80,
    });

    // auto scaling group
    const asgSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "AsgSecurityGroup",
      {
        securityGroupName: "AsgSecurityGroup",
        vpc: props.vpc,
      }
    );
    asgSecurityGroup.addIngressRule(
      aws_ec2.Peer.securityGroupId(
        albSecurityGroup.securityGroupId
      ),
      aws_ec2.Port.tcp(80)
    );

    const asg = new aws_autoscaling.AutoScalingGroup(
      this,
      "AsgForWebServerDemo",
      {
        autoScalingGroupName: "AsgWebServerDemo",
        vpc: props.vpc,
        instanceType: aws_ec2.InstanceType.of(
          aws_ec2.InstanceClass.T2,
          aws_ec2.InstanceSize.SMALL
        ),
        machineImage: new aws_ec2.AmazonLinuxImage({
          generation:
            aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          edition: aws_ec2.AmazonLinuxEdition.STANDARD,
        }),
        minCapacity: 2,
        maxCapacity: 10,
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        securityGroup: asgSecurityGroup,
      }
    );

    asg.addUserData(
      fs.readFileSync("./lib/script/user-data.sh", "utf8")
    );

    // integerate with alb
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

    // auto scaling strategies
    asg.scaleOnCpuUtilization("KeepSparseCPU", {
      targetUtilizationPercent: 50,
    })
  }
}
