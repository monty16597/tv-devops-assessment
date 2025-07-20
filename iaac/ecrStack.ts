import { TerraformStack, S3Backend } from "cdktf";
import { Construct } from "constructs";
import { AwsProvider } from "./.gen/providers/aws/provider";
import { EcrRepository } from "./.gen/providers/aws/ecr-repository";

export class EcrStack extends TerraformStack {
  public readonly app1EcrRepositoryName: string;

  constructor(scope: Construct, id: string,
    region: string = "ca-central-1",
    environmentName: string = "development",
    projectName: string = "local-project",
    remoteBackendBucketName: string | undefined,
    remoteBackendDynamoDBTableName: string | undefined,
  ) {
    super(scope, id);

    // Backend configuration
    new S3Backend(this, {
      bucket: `${remoteBackendBucketName}`,
      key: `${environmentName}/ecrrepo.tfstate`,
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
    this.app1EcrRepositoryName = app1EcrRepository.name;
  }
}
