# ---- Base image ----
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy application source
COPY index.js ./
COPY public ./public

# Environment configuration
# PORT can be overridden by Azure App Service / docker run
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port the app listens on
EXPOSE 8080

# Start the dashboard server
CMD ["node", "index.js"]
