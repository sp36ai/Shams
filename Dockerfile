FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy project files.
COPY . .

# Default command keeps the container valid for CI image builds.
CMD ["npm", "--version"]
