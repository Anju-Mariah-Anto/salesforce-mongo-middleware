# Salesforce → Mongo Middleware

This Node.js middleware syncs Salesforce PromptTemplateVersion data to MongoDB.

## Setup

1. Clone repo:
    ```bash
    git clone <repo_url>
    cd prompt-mongo-middleware

    cd /Users/anju/Desktop/prompt-mongo-middleware

2. Install dependencies:

     npm install
    
    npm init -y

3. Configure environment variables:

    cp .env.example .env
    # edit .env with your Mongo URI and DB name


4. Run server:

    npm start

# Endpoints

POST /sync_prompt_versions?domain=Prompt → UPSERT active versions

POST /delete_prompt_versions?domain=Prompt → DELETE versions

GET /health → Health check

