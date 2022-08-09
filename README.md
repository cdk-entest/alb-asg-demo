## Application Load Balander and Auto Scaling Group

- Create a VPC 
- Create a application load balancer 
- Create an autoscaling group (asg) 2-2-2
- Add userData to run a web 
- Terminate an EC2 and see (asg) launch a new EC2

![aws_devops-Expriment drawio(5)](https://user-images.githubusercontent.com/20411077/183557265-71d701b8-810c-4c4d-ab34-7f95f2007d61.png)


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
          subnets: vpc.publicSubnets,
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
