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

  constructor(
    scope: Construct,
    id: string,
    props: VpcProps
  ) {
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

interface ApplicationProps extends StackProps {
  vpc: aws_ec2.IVpc;
}

export class ApplicationStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ApplicationProps
  ) {
    super(scope, id, props);

    const vpc = props.vpc;

    const role = new aws_iam.Role(
      this,
      "RoleForWebServer",
      {
        roleName: "RoleForWebServer",
        assumedBy: new aws_iam.ServicePrincipal(
          "ec2.amazonaws.com"
        ),
      }
    );

    role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

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

    const listener = alb.addListener("AlbListener", {
      port: 80,
    });

    const asgSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "SGForASG",
      {
        securityGroupName: "SGForASG",
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
      "AsgDemo",
      {
        autoScalingGroupName: "AsgWebDemo",
        vpc: vpc,
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
          subnets: vpc.privateSubnets,
        },
        role: role,
        securityGroup: asgSecurityGroup,
      }
    );

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
      adjustmentType:
        aws_autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    asg.addUserData(
      fs.readFileSync("./lib/script/user-data.sh", "utf8")
    );

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
