import { TerraformStack, S3Backend, Token } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "./.gen/providers/aws/provider";
import { EcsCluster } from "./.gen/providers/aws/ecs-cluster";
import { EcsClusterCapacityProviders } from "./.gen/providers/aws/ecs-cluster-capacity-providers";
import { SecurityGroup } from "./.gen/providers/aws/security-group";
import { Lb } from "./.gen/providers/aws/lb";
import { LbListener } from "./.gen/providers/aws/lb-listener";
import { DataAwsRoute53Zone } from "./.gen/providers/aws/data-aws-route53-zone";
import { AcmCertificate } from "./.gen/providers/aws/acm-certificate";
import { Route53Record } from "./.gen/providers/aws/route53-record";

export class CommonResourceStack extends TerraformStack {
  public readonly ecsClusterName: string;
  public readonly loadBalancerArn: string;
  public readonly loadBalancerDnsName: string;
  public readonly loadBalancerZoneId: string;
  public readonly loadBalancerSecurityGroupId: string;
  public readonly loadBalancerListenerHttpsArn: string;

  constructor(scope: Construct, id: string,
    region: string = "ca-central-1",
    environmentName: string = "development",
    projectName: string = "local-project",
    remoteBackendBucketName: string | undefined,
    remoteBackendDynamoDBTableName: string | undefined,
    vpcId: string,
    publicSubnetIds: string,
    route53HostedZoneName: string
  ) {
    super(scope, id);

    // Providers
    new AwsProvider(this, "aws", {
      region: region
    });

    // Backend configuration
    new S3Backend(this, {
      bucket: `${remoteBackendBucketName}`,
      key: `${environmentName}/common-resource.tfstate`,
      region: region,
      encrypt: true,
      dynamodbTable: `${remoteBackendDynamoDBTableName}`,
    });

    // Route53 Zone Data Source
    const zone = new DataAwsRoute53Zone(this, "route53_zone", {
      name: `dev.devops-blogs.net`,
      privateZone: false,
    });


    // ACM Certificate
    const acmCertificate = new AcmCertificate(this, "acm_certificate", {
      domainName: `*.${route53HostedZoneName}`,
      validationMethod: "DNS",
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    new Route53Record(this, `acm_validation_record`, {
      count: Token.asList(acmCertificate.domainValidationOptions).length,
      zoneId: zone.zoneId,
      name: Token.asString(acmCertificate.domainValidationOptions.get(0).resourceRecordName),
      records: [Token.asString(acmCertificate.domainValidationOptions.get(0).resourceRecordValue)],
      type: Token.asString(acmCertificate.domainValidationOptions.get(0).resourceRecordType),
      ttl: 60,
      allowOverwrite: true,
    });

    // ECS Cluster
    const cluster = new EcsCluster(this, "ecs_cluster", {
      name: `${projectName}-${environmentName}-ecs-cluster`,
    });

    new EcsClusterCapacityProviders(this, "ecs_cluster_capacity_providers", {
      clusterName: cluster.name,
      capacityProviders: ["FARGATE_SPOT"],
      defaultCapacityProviderStrategy: environmentName === "production" ? [
        {
          capacityProvider: "FARGATE",
          weight: 1,
          base: 1
        }
      ] : [
        {
          capacityProvider: "FARGATE_SPOT",
          weight: 1,
          base: 1
        }
      ],
    });

    // Load Balancer 
    const securityGroupLb = new SecurityGroup(this, "lb_security_group", {
      name: `${projectName}-${environmentName}-lb-security-group`,
      description: "Security group for Load Balancer",
      vpcId: Token.asString(vpcId),
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"]
        },
        {
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"]
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
    });

    const loadBalancer = new Lb(this, "load_balancer", {
      name: `${projectName}-${environmentName}-lb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [securityGroupLb.id],
      subnets: Token.asList(publicSubnetIds),
      enableDeletionProtection: false,
      idleTimeout: 60,
      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    new LbListener(this, "load_balancer_listener", {
      loadBalancerArn: loadBalancer.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [{
        type: "redirect",
        redirect: {
          host: "#{host}",
          path: "/#{path}",
          port: "443",
          protocol: "HTTPS",
          query: "#{query}",
          statusCode: "HTTP_301"
        }
      }]
    });
    
    const loadBalancerListenerHttps = new LbListener(this, "load_balancer_listener_https", {
      loadBalancerArn: loadBalancer.arn,
      port: 443,
      protocol: "HTTPS",
      certificateArn: acmCertificate.arn,
      defaultAction: [{
        type: "fixed-response",
        fixedResponse: {
          contentType: "text/plain",
          messageBody: "Page is not found",
          statusCode: "404"
        }
      }]
    });

    this.ecsClusterName = cluster.name;
    this.loadBalancerArn = loadBalancer.arn;
    this.loadBalancerDnsName = loadBalancer.dnsName;
    this.loadBalancerZoneId = loadBalancer.zoneId;
    this.loadBalancerSecurityGroupId = securityGroupLb.id;
    this.loadBalancerListenerHttpsArn = loadBalancerListenerHttps.arn;
  }
}
