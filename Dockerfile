FROM node:24-slim

# Install Python and faiss dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create virtual environment and install faiss-cpu and numpy
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir faiss-cpu numpy

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install Node dependencies
RUN npm --prefix server install
RUN npm --prefix client install

# Copy source code
COPY . .

# Build frontend
RUN npm --prefix client run build

EXPOSE 3001

CMD ["npm", "--prefix", "server", "start"]
