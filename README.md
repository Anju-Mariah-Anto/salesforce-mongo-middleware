# Salesforce → Mongo Middleware

This Node.js middleware syncs Salesforce PromptTemplateVersion and Member Dependencies data to MongoDB. It is built using Express and adapted to run in **AWS Lambda** using `serverless-http`.

## Local Development Setup

1. Clone repo:
    ```bash
    git clone https://github.com/Anju-Mariah-Anto/salesforce-mongo-middleware.git
    cd salesforce-mongo-middleware
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Configure environment variables:
    Create a `.env` file in the root directory:
    ```env
    MONGO_URI=mongodb+srv://<username>:<password>@cluster0...
    MONGO_DB_NAME=YourDatabaseName
    ```

4. Run the server locally:
    ```bash
    npm start
    ```

## AWS Lambda Deployment

This application is designed to be zipped and uploaded directly to AWS Lambda.

### 1. Package the Code
Run the following command in your terminal to create a deployment package:
```bash
zip -r function.zip . -x "*.git*"
```
*(Ensure you have run `npm install` locally first, so the `node_modules` folder is included in the zip).*

### 2. Configure AWS Lambda
1. **Upload:** Go to your AWS Lambda function -> "Code" tab -> "Upload from" -> ".zip file".
2. **Environment Variables:** Go to the "Configuration" tab -> "Environment variables". Add `MONGO_URI` and `MONGO_DB_NAME`.
3. **Handler Setup:** Under the "Code" tab, edit "Runtime settings". Change the handler from `index.handler` to **`middleware.handler`**.
4. **Timeout:** Under "Configuration" -> "General configuration", increase the **Timeout** from 3 seconds to **30 seconds**. *(MongoDB connections often take longer than 3 seconds on a cold start).*

### 3. Connect to Salesforce
1. Go to your Lambda **Configuration** tab -> **Function URL** and create a Function URL (Auth type: `NONE` or `AWS_IAM`).
2. In Salesforce, paste this Function URL into your **Named Credential** URL field.

---

## Troubleshooting AWS Errors

### Error: `Cannot find module 'index'`
AWS Lambda is looking for `index.js` instead of `middleware.js`. 
* **Fix**: Change your Runtime settings Handler to `middleware.handler`.

### Error: `502 Bad Gateway` (Status: timeout)
The Lambda function was killed before it could finish connecting to MongoDB.
* **Fix 1:** Increase your Lambda Timeout to 30 seconds.
* **Fix 2:** Go to your MongoDB Atlas dashboard -> **Network Access** and ensure you have whitelisted the IP address `0.0.0.0/0` (Allow Access from Anywhere), since AWS Lambda uses dynamic IPs.

---

## Endpoints
* `POST /sync_prompt_versions?domain=Prompt` → UPSERT active versions
* `POST /delete_prompt_versions?domain=Prompt` → DELETE versions
* `POST /sync_member_dependencies` → UPSERT member dependencies
* `GET /health` → Health check
