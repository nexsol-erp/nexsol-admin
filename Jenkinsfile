pipeline {
    agent any

    environment {
        REACT_REPO = 'https://github.com/nexsol-erp/nexsol-admin.git'
        DEPLOY_DIR = '/var/www/html' // Directory served by Nginx
        SERVICE_NAME = 'nginx' // Assuming Nginx service is managed here
        STATIC_RESOURCES_DIR = 'src/main/resources/static'
        CI = ''  // Unset the CI environment variable
        GIT_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=no'
    }

    tools {
        nodejs 'NodeJS'  // Name of the NodeJS installation configured in Jenkins
    }

    stages {
        stage('Checkout React Project') {
            steps {
                dir('react-project') {
                    checkout([$class: 'GitSCM', branches: [[name: '*/main']], userRemoteConfigs: [[url: "${REACT_REPO}", credentialsId: 'github-pat']]])
                }
            }
        }
        
        stage('Build React Project') {
            steps {
                dir('react-project') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    sh 'sudo cp -r react-project/build/* ${DEPLOY_DIR}'
                    sh 'sudo systemctl reload ${SERVICE_NAME}' // Reload Nginx configuration
                }
            }
        }
    }

    post {
        success {
            echo 'Build and deployment succeeded!'
        }

        failure {
            echo 'Build or deployment failed.'
        }

        always {
            cleanWs() // Clean workspace after build
        }
    }
}
