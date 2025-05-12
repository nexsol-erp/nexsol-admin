pipeline {
    agent any

    environment {
        REACT_REPO = 'https://github.com/nexsol-erp/nexsol-admin.git'
        DEPLOY_DIR = '/var/www/html'  
        SERVICE_NAME = 'nginx'  
        STATIC_RESOURCES_DIR = 'src/main/resources/static'

        CI = ''  
        
        SSH_KEY_PATH = '/root/.ssh/id_rsa'  // Path to the private SSH key to use for authentication 
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

                // Heartbeat wrapper to prevent Jenkins timeout
                sh '''
                #!/bin/bash
                echo "Starting React build with heartbeat..."
                while sleep 30; do echo "[Heartbeat] Still building..."; done &
                HEARTBEAT_PID=$!
                npm run build
                BUILD_RESULT=$?
                kill $HEARTBEAT_PID
                exit $BUILD_RESULT
                '''
                }
            }
        }

        stage('Deploy to Local Server') {
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
