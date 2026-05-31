Internet
    │
    ▼
┌──────────────────┐        ┌─────────────────────────────────────┐
│   CloudFront CDN │        │              AWS VPC                │
│  (nexsol-admin   │        │                                     │
│   React SPA)     │        │  ┌──────────────────────────────┐   │
└────────┬─────────┘        │  │     Public Subnet            │   │
         │                  │  │  ┌──────────────────────┐    │   │
         │  /api/*          │  │  │  EC2 t3.small        │    │   │
         └──────────────────┼──►  │  Spring Boot JAR     │    │   │
                            │  │  │  systemd: nxserver   │    │   │
    S3 Bucket               │  │  │  port 8080           │    │   │
  (static files)            │  │  └──────────┬───────────┘    │   │
       ▲                    │  └─────────────┼────────────────┘   │
       │ served by          │                │ 5432               │
  CloudFront                │  ┌─────────────▼────────────────┐   │
                            │  │     Private Subnet           │   │
                            │  │  RDS PostgreSQL (db.t3.micro)│   │
                            │  └──────────────────────────────┘   │
                            └─────────────────────────────────────┘


# Why this layout:

Matches your existing deploy_server.yml exactly — just swap DEPLOY_HOST to the EC2 IP
No Docker required, no new tools to learn
RDS handles backups, snapshots, and failover automatically
CloudFront gives HTTPS + caching for free, globally
# Step-by-Step Process
## Phase 1 — AWS Account Setup
    Create an IAM user with programmatic access (for GitHub Actions)
    
    Create a key pair for EC2 SSH access — download the .pem

## Phase 2 — Database (RDS PostgreSQL)
Create RDS → PostgreSQL 15 → db.t3.micro (free tier eligible)

Place in a private subnet (no public access)

Set a strong master password

Note the endpoint: nexsol.xxxx.rds.amazonaws.com

Security Group for RDS: allow inbound 5432 only from the EC2 security group

Migrate your schema: run your postgres_schema.sql against RDS


psql -h nexsol.xxxx.rds.amazonaws.com -U postgres -d nexsoldb -f postgres_schema.sql

# Phase 3 — Backend (EC2 + Spring Boot)
Launch EC2 → Ubuntu 24.04 → t3.small → same VPC, public subnet

Security group: allow 22 (SSH from your IP only), 8080 (from CloudFront IP ranges or ALB)
Assign an Elastic IP so it doesn't change on restart
SSH in and set up Java + systemd:


sudo apt update && sudo apt install openjdk-17-jdk -y

# Create systemd service
sudo tee /etc/systemd/system/nxserver.service <<EOF
[Unit]
Description=Nexsol Server
After=network.target

[Service]
User=deploy
WorkingDirectory=/home/deploy/server
ExecStart=/usr/bin/java -jar /home/deploy/server/nexsol-server.jar \
  --spring.datasource.url=jdbc:postgresql://nexsol.xxxx.rds.amazonaws.com:5432/nexsoldb \
  --spring.datasource.username=postgres \
  --spring.datasource.password=YOUR_PASS
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo useradd -m deploy
sudo mkdir -p /home/deploy/server
sudo systemctl enable nxserver
Update GitHub Actions secrets in nexsol-server-postgress:

DEPLOY_HOST → your EC2 Elastic IP
DEPLOY_USER → deploy
SSH_PRIVATE_KEY → contents of your .pem file
Your existing deploy_server.yml works unchanged after this.

Phase 4 — Frontend (S3 + CloudFront)
Create S3 bucket → name it e.g. nexsol-admin-web → block all public access (CloudFront will serve it)

Create CloudFront distribution:

Origin: the S3 bucket (use OAC — Origin Access Control)
Default root object: index.html
Error pages: 403 → /index.html (needed for React Router)
Add a /api/* origin pointing to your EC2 or ALB — this lets the SPA call the backend without CORS issues
Add a deploy step to GitHub Actions for nexsol-admin:


- name: Build
  run: npm run build
  env:
    REACT_APP_API_BASE_URL: https://your-cloudfront-domain.cloudfront.net

- name: Deploy to S3
  run: aws s3 sync build/ s3://nexsol-admin-web --delete

- name: Invalidate CloudFront cache
  run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"
Set GitHub secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CF_DIST_ID


# Phase 5 — HTTPS / Domain (Optional but recommended)

Buy/transfer domain in Route 53 (or point your existing DNS)
Request a free cert in ACM (us-east-1 region — required for CloudFront)
Attach cert to CloudFront distribution → custom domain done



# Cost Estimate (monthly)
Service	Spec	~Cost
EC2 t3.small	Spring Boot	~$15
RDS db.t3.micro	PostgreSQL	~$15
S3	Static files	< $1
CloudFront	First 1TB free	$0–$5
Total		~$30–35/mo

# What to do first
Create the RDS instance and migrate your schema — database is the longest lead time
Launch EC2, set up systemd, test a manual JAR deploy
Push to main on the server repo → GitHub Actions deploys automatically (your existing workflow works)
Build frontend, upload to S3, set up CloudFront
Update REACT_APP_API_BASE_URL in the build to point at your CloudFront/EC2 URL