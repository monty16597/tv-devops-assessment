import { TerraformStack, S3Backend, TerraformOutput, Token } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "./.gen/providers/aws/provider";
import { EcrRepository } from "./.gen/providers/aws/ecr-repository";
import { IamRole } from "./.gen/providers/aws/iam-role";
import { IamPolicy } from "./.gen/providers/aws/iam-policy";
import { IamPolicyAttachment } from "./.gen/providers/aws/iam-policy-attachment";
import { EcsTaskDefinition } from "./.gen/providers/aws/ecs-task-definition";
import { EcsService } from "./.gen/providers/aws/ecs-service";
import { SecurityGroup } from "./.gen/providers/aws/security-group";
import { LbListenerRule } from "./.gen/providers/aws/lb-listener-rule";
import { LbTargetGroup } from "./.gen/providers/aws/lb-target-group";
import { DataAwsRoute53Zone } from "./.gen/providers/aws/data-aws-route53-zone";
import { Route53Record } from "./.gen/providers/aws/route53-record";

export class ApplicationStack extends TerraformStack {
  constructor(scope: Construct, id: string,
    region: string = "ca-central-1",
    environmentName: string = "development",
    projectName: string = "local-project",
    remoteBackendBucketName: string | undefined,
    remoteBackendDynamoDBTableName: string | undefined,
    vpcId: string,
    privateSubnetIds: string,
    loadBalancerDnsName: string,
    loadBalancerZoneId: string,
    loadBalancerListenerHttpsArn: string,
    loadBalancerSecurityGroupId: string,
    ecsClusterName: string,
    appPort: number = 80,
    appDomainName: string,
    route53HostedZoneName: string,
    app1ContainerImageTag: string
  ) {
    super(scope, id);

    // Backend configuration
    new S3Backend(this, {
      bucket: `${remoteBackendBucketName}`,
      key: `${environmentName}/application.tfstate`,
      region: region,
      encrypt: true,
      dynamodbTable: `${remoteBackendDynamoDBTableName}`,
    });

    // Providers
    new AwsProvider(this, "aws", {
      region: region,
    });

    // ECR Repository
    const app1EcrRepository = new EcrRepository(this, "ecr_repository", {
      name: `${projectName}-${environmentName}-app1`,
      imageTagMutability: "MUTABLE",
      forceDelete: true,
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    // IAM Role for ECS Task Execution
    const app1TaskExecutionRole = new IamRole(this, "ecs/task-execution", {
      name: `${projectName}-${environmentName}-ecs-task-execution-role`,
      path: "/ecs/",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com"
            }
          }
        ]
      }),
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    const app1TaskExecutionPolicy = new IamPolicy(this, "ecs/task-execution-policy", {
      name: `${projectName}-${environmentName}-ecs-task-execution-policy`,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "logs:CreateLogGroup",
            Effect: "Allow",
            Resource: "*"
          },
          {
            Action: "logs:CreateLogStream",
            Effect: "Allow",
            Resource: "*"
          },
          {
            Action: "logs:PutLogEvents",
            Effect: "Allow",
            Resource: "*"
          },
          {
            Action: "ecr:GetAuthorizationToken",
            Effect: "Allow",
            Resource: `*`
          },
          {
            Action: "ecr:BatchCheckLayerAvailability",
            Effect: "Allow",
            Resource: `${app1EcrRepository.arn}`
          },
          {
            Action: "ecr:GetDownloadUrlForLayer",
            Effect: "Allow",
            Resource: `${app1EcrRepository.arn}`
          },
          {
            Action: "ecr:BatchGetImage",
            Effect: "Allow",
            Resource: `${app1EcrRepository.arn}`
          },
        ]
      }),
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    new IamPolicyAttachment(this, "ecs/task-execution-policy-attachment", {
      name: `${projectName}-${environmentName}-ecs-task-execution-policy-attachment`,
      roles: [app1TaskExecutionRole.name],
      policyArn: app1TaskExecutionPolicy.arn
    });


    // IAM Role for ECS Task
    const app1TaskRole = new IamRole(this, "ecs/task-role", {
      name: `${projectName}-${environmentName}-ecs-task-role`,
      path: "/ecs/",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com"
            }
          }
        ]
      }),
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    // ECS Task Definition
    const app1TaskDefinition = new EcsTaskDefinition(this, "ecs_task_definition", {
      family: `${projectName}-${environmentName}-task`,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: "256",
      memory: "512",
      executionRoleArn: app1TaskExecutionRole.arn,
      taskRoleArn: app1TaskRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: "app",
          image: `${app1EcrRepository.repositoryUrl}:${app1ContainerImageTag}`,
          cpu: 256,
          memory: 512,
          essential: true,
          portMappings: [
            {
              containerPort: appPort,
              hostPort: appPort,
              protocol: "tcp"
            }
          ]
        }
      ]),
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });


    // Security Group for ECS Service
    const securityGroup = new SecurityGroup(this, "ecs_security_group", {
      name: `${projectName}-${environmentName}-ecs-security-group`,
      description: "Security group for ECS service",
      vpcId: Token.asString(vpcId),
      ingress: [
        {
          fromPort: appPort,
          toPort: appPort,
          protocol: "tcp",
          securityGroups: [Token.asString(loadBalancerSecurityGroupId)], // Replace with actual security group ID
          description: "Allow traffic from load balancer",
        }
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"]
        }
      ],
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    const targetGroup = new LbTargetGroup(this, "load_balancer_target_group", {
      lifecycle: {
        createBeforeDestroy: true,
      },
      namePrefix: `app1-`,
      port: appPort,
      protocol: "HTTP",
      vpcId: Token.asString(vpcId),
      targetType: "ip",
      healthCheck: {
        path: "/",
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 2
      }
    });

    new LbListenerRule(this, "load_balancer_listener_rule", {
      listenerArn: Token.asString(loadBalancerListenerHttpsArn),
      priority: 100,
      action: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn
        }
      ],
      condition: [
        {
          hostHeader: {
            values: [`${appDomainName}`] // Replace with your domain
          }
        }
      ],
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    new EcsService(this, "ecs_service", {
      name: `${projectName}-${environmentName}-ecs-service`,
      cluster: Token.asString(ecsClusterName),
      taskDefinition: app1TaskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: Token.asList(privateSubnetIds),
        securityGroups: [securityGroup.id], // Replace with actual security group ID
        assignPublicIp: false
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: "app",
          containerPort: appPort
        }
      ],
      tags: {
        "Environment": environmentName,
        "Project": projectName
      },
    });

    const zone = new DataAwsRoute53Zone(this, "route53_zone", {
      name: route53HostedZoneName,
      privateZone: false,
    });

    new Route53Record(this, "app1_dns_record", {
      zoneId: zone.zoneId,
      name: `app1.${zone.name}`,
      type: "A",
      alias: {
        name: Token.asString(loadBalancerDnsName),
        zoneId: Token.asString(loadBalancerZoneId),
        evaluateTargetHealth: true
      },
    });

    // Outputs
    new TerraformOutput(this, "application_url", {
      value: `https://${appDomainName}`
    });
  }
}
