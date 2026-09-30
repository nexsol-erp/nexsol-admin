# Container image for the admin web app, used by the Docker stack in nexsol-erp/nexsol-deploy.
# The current deployment (deploy.yml -> /var/www/html) does not use it. pos-electron is not
# part of this image: the POS stays a Windows installer built by deploy.yml.

FROM node:18-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY vendor ./vendor
# npm can exit 0 after an internal crash with half-installed modules, so check the result.
RUN npm ci --no-audit --no-fund && test -x node_modules/.bin/react-scripts
COPY public ./public
COPY src ./src
# CI='' so CRA does not turn lint warnings into build failures, same as deploy.yml.
RUN CI='' npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
