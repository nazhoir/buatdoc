# Express.js Example for DOCX Engine

This example demonstrates how to run a Node.js server using Express that takes advantage of `buatdoc` to generate documents based on templates.

## Setup

1. Make sure you are inside this `examples/expressjs` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Place a sample Microsoft Word `template.docx` file inside this directory (for testing the `/generate/local` route). Or you can test other remote endpoints.

## Running the Server

```bash
npm start
```
The server will be available at `http://localhost:3000`.

## Endpoints Provided

- `POST /generate` — Generates a payload based on an external `templateUrl` and responds with a `.docx` file attachment.
- `POST /generate/base64` — Similar to above, but responds with a JSON containing the base64 output.
- `POST /generate/s3` — Uploads the generated file directly to AWS S3.
- `GET /generate/local` — Generates a `.docx` file based on a local `./template.docx` and saves it to `./output-generated.docx` as a demo.

### Example Request (`POST /generate/base64`)

```bash
curl -X POST http://localhost:3000/generate/base64 \
  -H 'Content-Type: application/json' \
  -d '{
        "templateUrl": "https://example.com/template.docx",
        "data": {
          "nama": "Andika Putra",
          "judul": "Belajar Express",
          "isPremium": true
        }
      }'
```
