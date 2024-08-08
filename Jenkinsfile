pipeline {
    agent any

    environment {
        REACT_REPO = 'https://github.com/nexsol-erp/nexsol-admin.git'
        DEPLOY_DIR = '/root/webmodule'
        SERVICE_NAME = 'nxwebmodule.service'
        STATIC_RESOURCES_DIR = 'src/main/resources/static'

         CI = ''  // Unset the CI environment variable

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
                    sh 'sudo systemctl stop ${SERVICE_NAME}'
                    sh 'scp -r build/* ${DEPLOY_DIR}'
                    sh 'sudo systemctl start ${SERVICE_NAME}'
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
