import { TerraformStack, S3Backend } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "./.gen/providers/aws/provider";
import { DataAwsAvailabilityZones } from "./.gen/providers/aws/data-aws-availability-zones";
import { S3Bucket } from "./.gen/providers/aws/s3-bucket";
import { Vpc } from "./.gen/modules/vpc";

export class NetworkingStack extends TerraformStack {

  public readonly vpcId: string;
  public readonly publicSubnetIds: string;
  public readonly privateSubnetIds: string;

  constructor(scope: Construct, id: string,
    region: string = "ca-central-1",
    environmentName: string = "development",
    projectName: string = "local-project",
    remoteBackendBucketName: string | undefined,
    remoteBackendDynamoDBTableName: string | undefined
  ) {
    super(scope, id);

    // Backend configuration
    new S3Backend(this, {
      bucket: `${remoteBackendBucketName}`,
      key: `${environmentName}/networking.tfstate`,
      region: region,
      encrypt: true,
      dynamodbTable: `${remoteBackendDynamoDBTableName}`,
    })

    // Providers
    new AwsProvider(this, "aws", {
      region: region
    });

    const azs = new DataAwsAvailabilityZones(this, "availability_zones", {
      state: "available",
      region: region
    });

    // VPC Module
    // Module Source: https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest
   const resources = new Vpc(this, "vpc", {
      cidr: `10.0.0.0/16`,
      azs: azs.names,

      publicSubnetNames: [
       `${projectName}-${environmentName}-public-subnet-1`,
       `${projectName}-${environmentName}-public-subnet-2`,
       `${projectName}-${environmentName}-public-subnet-3`
      ],

      publicSubnets: [
       `10.0.0.0/24`,
       `10.0.1.0/24`,
       `10.0.2.0/24`
      ],

      privateSubnetNames: [
        `${projectName}-${environmentName}-private-subnet-1`,
        `${projectName}-${environmentName}-private-subnet-2`,
        `${projectName}-${environmentName}-private-subnet-3`
      ],

      privateSubnets: [
        `10.0.20.0/24`,
        `10.0.21.0/24`,
        `10.0.22.0/24`
     ],

      enableDnsHostnames: true,
      enableDnsSupport: true,
      enableNatGateway: true,
      singleNatGateway: true,

      tags: {
        "Environment": environmentName,
        "Project": projectName
      }
    });

    new S3Bucket(this, "networking_state_bucket", {
      bucket: remoteBackendBucketName,
      forceDestroy: true,
      acl: "private",
      tags: {
        "Environment": environmentName,
        "Project": projectName,
        "ManagedBy": "CDKTF"
      }
    });

   this.vpcId = resources.vpcIdOutput;
   this.publicSubnetIds = resources.publicSubnetsOutput;
   this.privateSubnetIds = resources.privateSubnetsOutput;
  }
}
