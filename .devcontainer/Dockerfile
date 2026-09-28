FROM node:24

# match @playwright/test in package.json
ARG PLAYWRIGHT_VERSION=1.63.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable \
 && npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium \
 && chmod -R a+rX /ms-playwright \
 && curl -Ls https://cli.doppler.com/install.sh | sh

USER node