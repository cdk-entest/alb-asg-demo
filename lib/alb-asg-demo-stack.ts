import {
  Stack,
  StackProps,
  aws_ec2,
  aws_autoscaling,
  aws_elasticloadbalancingv2,
  aws_iam,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Effect } from "aws-cdk-lib/aws-iam";
import * as fs from "fs";

interface VpcProps extends StackProps {
  cidr: string;
}

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

interface ApplicationProps extends StackProps {
  vpc: aws_ec2.Vpc;
}

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id, props);

    const vpc = props.vpc;

    const role = new aws_iam.Role(this, "RoleForWebServer", {
      roleName: "RoleForWebServer",
      assumedBy: new aws_iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:*"],
        resources: ["*"],
      })
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
      aws_ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId),
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
          generation: aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          edition: aws_ec2.AmazonLinuxEdition.STANDARD,
        }),
        minCapacity: 2,
        maxCapacity: 2,
        vpcSubnets: {
          subnets: vpc.publicSubnets,
        },
        role: role,
        securityGroup: asgSecurityGroup,
      }
    );

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
