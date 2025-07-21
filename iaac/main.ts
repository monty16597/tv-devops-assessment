import { App } from "cdktf";
import { config } from 'dotenv';
import { NetworkingStack } from "./networkingStack";
import { ApplicationStack } from "./applicationStack";
import { CommonResourceStack } from "./commonResourceStack";
import { EcrStack } from "./ecrStack";

config({ path: `.env.${process.env.APP_ENV || 'development'}` })

const projectName = process.env.PROJECT_NAME || "local-project";
const region = process.env.AWS_REGION || "ca-central-1";
const environmentName = process.env.APP_ENV || "development";
const remoteBackendBucketName = process.env.REMOTE_BACKEND_BUCKET_NAME;
const remoteBackendDynamoDBTableName = process.env.REMOTE_BACKEND_DYNAMODB_TABLE_NAME;
const appDomainName = process.env.APP_DOMAIN_NAME || "app1.example.com";
const route53HostedZoneName = process.env.ROUTE53_HOSTED_ZONE_NAME || "dev.example.com";
const appPort = parseInt(process.env.APP_PORT || "80");
const app1ContainerImageTag = process.env.APP1_CONTAINER_IMAGE_TAG || "latest"; 

const app = new App();

const ecrStack = new EcrStack(
  app,
  `EcrStack`,
  region,
  environmentName,
  projectName,
  remoteBackendBucketName,
  remoteBackendDynamoDBTableName,
);

const networkingStack = new NetworkingStack(
  app,
  `Networking`,
  region,
  environmentName,
  projectName,
  remoteBackendBucketName,
  remoteBackendDynamoDBTableName,
);

const commonResourceStack = new CommonResourceStack(
  app,
  `CommonResource`,
  region,
  environmentName,
  projectName,
  remoteBackendBucketName,
  remoteBackendDynamoDBTableName,
  networkingStack.vpcId,
  networkingStack.publicSubnetIds,
  appDomainName,
  route53HostedZoneName
);

 new ApplicationStack(
  app,
  `Application`,
  region,
  environmentName,
  projectName,
  remoteBackendBucketName,
  remoteBackendDynamoDBTableName,
  networkingStack.vpcId,
  networkingStack.privateSubnetIds,
  commonResourceStack.loadBalancerDnsName,
  commonResourceStack.loadBalancerZoneId,
  commonResourceStack.loadBalancerListenerHttpsArn,
  commonResourceStack.loadBalancerSecurityGroupId,
  commonResourceStack.ecsClusterName,
  appPort,
  appDomainName,
  route53HostedZoneName,
  ecrStack.app1EcrRepositoryName,
  app1ContainerImageTag
);

app.synth();
