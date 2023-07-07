import {
  Stack,
  StackProps,
  aws_ec2,
  aws_autoscaling,
  aws_elasticloadbalancingv2,
  aws_iam,
  Duration,
  aws_cloudwatch,
} from "aws-cdk-lib";
import { Effect } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as fs from "fs";

interface VpcProps extends StackProps {
  cidr: string;
}

interface ImportedVpcProps extends StackProps {
  vpcId: string;
  vpcName: string;
}

export class ImportedVpcStack extends Stack {
  public readonly vpc: aws_ec2.IVpc;

  constructor(scope: Construct, id: string, props: ImportedVpcProps) {
    super(scope, id, props);

    this.vpc = aws_ec2.Vpc.fromLookup(this, "LookupExistedVpc", {
      vpcId: props.vpcId,
      vpcName: props.vpcName,
    });
  }
}

export class VpcStack extends Stack {
  public readonly vpc: aws_ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id, props);

    this.vpc = new aws_ec2.Vpc(this, "VpcAlbDemo", {
      vpcName: "VpcAlbDemo",
      cidr: props.cidr,
      // max number of az
      maxAzs: 2,
      // enable dns
      enableDnsHostnames: true,
      // enable dns
      enableDnsSupport: true,
      // aws nat gateway service not instance
      natGatewayProvider: aws_ec2.NatInstanceProvider.gateway(),
      // can be less than num az default 1 natgw/zone
      natGateways: 1,
      // subnet configuration per zone
      subnetConfiguration: [
        {
          name: "Public",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        {
          name: "PrivateWithNat",
          cidrMask: 24,
          subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
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

interface ApplicationProps extends StackProps {
  vpc: aws_ec2.IVpc;
}

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id, props);

    const vpc = props.vpc;

    const role = new aws_iam.Role(this, "RoleForWebServer", {
      roleName: "RoleForWebServer",
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    // allow ssm connection
    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    // allow read and write s3
    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["s3:*"],
      })
    );

    // allow call poly service
    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["polly:*"],
      })
    );

    const albSecurityGroup = new aws_ec2.SecurityGroup(this, "SGForWeb", {
      securityGroupName: "SGForWeb",
      vpc: vpc,
    });

    albSecurityGroup.addIngressRule(
      aws_ec2.Peer.anyIpv4(),
      aws_ec2.Port.tcp(80),
      "Allow port 80 web"
    );

    const alb = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
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

    const listener = alb.addListener("AlbListener", {
      port: 80,
    });

    const asgSecurityGroup = new aws_ec2.SecurityGroup(this, "SGForASG", {
      securityGroupName: "SGForASG",
      vpc: props.vpc,
    });

    asgSecurityGroup.addIngressRule(
      aws_ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
      aws_ec2.Port.tcp(80)
    );

    const asg = new aws_autoscaling.AutoScalingGroup(this, "AsgDemo", {
      autoScalingGroupName: "AsgWebDemo",
      vpc: vpc,
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T2,
        aws_ec2.InstanceSize.SMALL
      ),
      // machineImage: new aws_ec2.AmazonLinuxImage({
      //   generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      //   edition: aws_ec2.AmazonLinuxEdition.STANDARD,
      // }),
      machineImage: aws_ec2.MachineImage.latestAmazonLinux2023({
        cachedInContext: true,
      }),
      minCapacity: 2,
      maxCapacity: 10,
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
      role: role,
      securityGroup: asgSecurityGroup,
    });

    // target tracking - cpu usage
    // asg.scaleOnCpuUtilization("KeepSparseCPU", {
    //   targetUtilizationPercent: 50,
    // });

    // target tracking - no request per instance
    // asg.scaleOnRequestCount("AvgReqeustPerInstance", {
    //   targetRequestsPerMinute: 1000,
    // });

    // step scaling - custom metric
    const metric = new aws_cloudwatch.Metric({
      metricName: "CPUUtilization",
      namespace: "AWS/EC2",
      statistic: "Average",
      period: Duration.minutes(1),
      dimensionsMap: {
        AutoScalingGroupName: asg.autoScalingGroupName,
      },
    });

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
      adjustmentType: aws_autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    asg.addUserData(fs.readFileSync("./lib/script/user-data-3.sh", "utf8"));

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
  }
}

interface WebServerProps extends StackProps {
  vpc: aws_ec2.Vpc;
}

export class WebServerStack extends Stack {
  constructor(scope: Construct, id: string, props: WebServerProps) {
    super(scope, id, props);

    // security group for webserver
    const sg = new aws_ec2.SecurityGroup(this, "WebServerPollySecurityGroup", {
      vpc: props.vpc,
      securityGroupName: "WebServerPollySecurityGroup",
    });

    sg.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80));

    sg.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(22));

    // iam role for web server
    const role = new aws_iam.Role(this, "RoleForWebServerPollyDemo", {
      roleName: "RoleForWebServerPollyDemo",
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    // allow ssm connection
    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    // allow read and write s3
    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["s3:*"],
      })
    );

    // allow call poly service
    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["polly:*"],
      })
    );

    // ec2 for web server
    const ec2 = new aws_ec2.Instance(this, "WebServerPollyDemo", {
      instanceName: "WebServerPollyDemo",
      role: role,
      vpc: props.vpc,
      securityGroup: sg,
      vpcSubnets: {
        subnetType: aws_ec2.SubnetType.PUBLIC,
      },
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T2,
        aws_ec2.InstanceSize.SMALL
      ),

      // machineImage: new aws_ec2.AmazonLinuxImage({
      //   generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      //   edition: aws_ec2.AmazonLinuxEdition.STANDARD,
      // }),

      machineImage: aws_ec2.MachineImage.latestAmazonLinux2023({
        cachedInContext: true,
      }),
    });

    ec2.addUserData(fs.readFileSync("./lib/script/user-data-3.sh", "utf8"));
  }
}
