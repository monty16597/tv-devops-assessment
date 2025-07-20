# 🚀 DevOps Assessment – Full Lifecycle Challenge

## Local Development Setup
### Prerequisites
- Docker
- Docker Compose

### Steps

1. Go to the `app` directory
2. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/tv-devops-assessment.git
   cd tv-devops-assessment
   ```
3. **Build and Start the Application**
   ```bash
   docker-compose up --build
   ```
4. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`.


NOTE: Code does not contain `/health` endpoint, so health checks will not work as expected.