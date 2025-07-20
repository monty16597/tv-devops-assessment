# 🚀 DevOps Assessment – Full Lifecycle Challenge

## Local Development Setup
### Prerequisites
- Docker
- Docker Compose

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/tv-devops-assessment.git
   cd tv-devops-assessment
   ```
2. **Build and Start the Application**
   ```bash
   docker-compose up --build
   ```
3. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`.


NOTE: Code does not contain `/health` endpoint, so health checks will not work as expected.

## CICD

Files:
- .github/workflows/app-ci.yaml: This file contains the CI pipeline configuration for building and testing the application. Runs on pull request and perform build and test steps.
- .github/workflows/app-cd.yaml: This file contains the CD pipeline configuration for deploying the application to AWS ECS. It triggers on push to the main branch and Build-Push docker Image , then deploys on ECS service. Also updates, task definition image URI and ECS Service.
### Prerequisites
- Make sure you have successfully deployed IaaC stacks as per the instructions in `iaac/README.md`.

### Steps
- Create three diifferent environments in Github:
  - `development`
  - `staging`
  - `production`
- Add your AWS credentials to GitHub secrets in each environment:
  - `AWS_ACCESS_KEY_ID`: Your AWS access key ID
  - `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
- Add below env variables in each environment:
  - `AWS_REGION`: e.g., `us-east-1`
  - `AWS_ACCOUNT_ID`: Your AWS account ID
  - `AWS_ECR_REPO_NAME`: Name of your ECR repository
  - `ECS_CLUSTER_NAME`: Name of your ECS cluster
  - `ECS_SERVICE_NAME`: Name of your ECS service
  - `ECS_TASK_DEFINITION_NAME`: Name of your ECS task definition
- If you are following same file structure as this repo, where you keep iaac files in `iaac` folder and application code in `app` folder, then you do not need to change anything in the workflow files. If you want to upload iaac and app at root location in  different repos, then do following:
  - In `.github/workflows/app-ci.yaml` and `.github/workflows/app-cd.yaml`, Remove the `paths` from `on.push` and `on.pull_request` sections. and remove `/app` from `env.APP_PATH` in both files.
- Push your changes to the main branch of your repository. Main branch will trigger the CD pipeline and deploy the application to AWS ECS of dev env.
- Create two more branches for staging and production environments, and name them `release/staging` and `release/production`. Push these branches to the repository. This will trigger the CD pipeline for staging and production environments.