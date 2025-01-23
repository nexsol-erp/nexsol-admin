pipeline {
    agent any

    environment {
        REACT_REPO = 'https://github.com/nexsol-erp/nexsol-admin.git'
        DEPLOY_DIR = '/var/www/html'  
        SERVICE_NAME = 'nginx'  
        STATIC_RESOURCES_DIR = 'src/main/resources/static'

        CI = ''  
        REMOTE_SERVER = 'root@161.35.111.127' // Set your remote server IP and SSH username
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
                    sh 'npm run build'
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

         stage('Deploy to Remote Server') {
            steps {
                script {
                     // Ensure the deploy directory exists on the remote server
                    sh "ssh -i ${SSH_KEY_PATH} ${REMOTE_SERVER} 'mkdir -p ${DEPLOY_DIR}'"
                   
                    // Copy build files to the remote server
                    sh "scp -i ${SSH_KEY_PATH} -r react-project/build/* ${REMOTE_SERVER}:${DEPLOY_DIR}"

                    // Reload Nginx configuration on the remote server
                    sh "ssh -i ${SSH_KEY_PATH} ${REMOTE_SERVER} 'sudo systemctl reload ${SERVICE_NAME}'"
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
